// ElectronメインプロセスのESM名前付きexportは環境によって解決に失敗するため、
// デフォルトインポート経由で分割代入する
import electron from 'electron';
const { app, Tray, Menu, Notification, shell, nativeImage } = electron;
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { startPolling, formatDuration } from './poller.js';
import { createStatusIconPng, aggregateStatus } from './icon.js';
import { buildTooltip } from './tooltip.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = loadConfig(join(__dirname, '..', 'data', 'config.json'));

app.setName('StarScout');
app.setAppUserModelId('com.starscout.tray'); // Windows Toast通知に必要

let tray;
let stopPolling;

function iconFor(status) {
  return nativeImage.createFromBuffer(createStatusIconPng(status, 32));
}

function notify(title, body) {
  new Notification({ title, body }).show();
}

// FR-009/FR-010/FR-010a: DOWN/RECOVERED/WARNINGのそれぞれをWindows Toastで通知する
function handleEvents(events) {
  for (const event of events) {
    if (event.type === 'down') {
      notify(
        `\u{1F534} ${event.target.name} is DOWN`,
        `${event.target.url}\n\nReason: ${event.target.lastError ?? 'unknown'}`
      );
    } else if (event.type === 'recovered') {
      notify(
        `\u{1F7E2} ${event.target.name} recovered`,
        `HTTP ${event.target.lastHttpStatus ?? '-'}\nDowntime: ${formatDuration(event.downtimeMs)}`
      );
    } else if (event.type === 'warning') {
      notify(
        `\u{1F7E1} ${event.target.name} is slow`,
        `${event.target.url}\n\nResponse time: ${event.target.lastResponseTimeMs} ms`
      );
    }
  }
}

function buildMenu() {
  return Menu.buildFromTemplate([
    { label: 'ダッシュボードを開く', click: () => shell.openExternal(config.serverUrl) },
    { type: 'separator' },
    { label: '終了', click: () => app.quit() },
  ]);
}

app.whenReady().then(() => {
  tray = new Tray(iconFor('UNKNOWN'));
  tray.setToolTip('StarScout');
  tray.setContextMenu(buildMenu());
  tray.on('click', () => shell.openExternal(config.serverUrl)); // FR-011候補: Dashboard起動

  stopPolling = startPolling(config.serverUrl, {
    intervalMs: config.pollIntervalMs,
    onStatus: (data) => {
      const status = aggregateStatus(data.targets);
      tray.setImage(iconFor(status));
      tray.setToolTip(buildTooltip(data.targets));
    },
    onEvents: handleEvents,
    onError: (err) => console.error('[tray] poll error:', err.message),
  });
});

// System Trayに常駐するアプリのため、ウィンドウが無い状態でも終了しない
app.on('window-all-closed', (event) => {
  event.preventDefault();
});

app.on('before-quit', () => {
  stopPolling?.();
});
