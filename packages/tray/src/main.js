// ElectronメインプロセスのESM名前付きexportは環境によって解決に失敗するため、
// デフォルトインポート経由で分割代入する
import electron from 'electron';
const { app, Tray, Menu, Notification, shell, nativeImage } = electron;
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, saveConfig } from './config.js';
import { startPolling } from './poller.js';
import { createStatusIconPng, aggregateStatus } from './icon.js';
import { buildTooltip } from './tooltip.js';
import { playTestNotificationScenario } from './testNotification.js';
import { buildNotificationPlan } from './notifications.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

app.setName('StarScout');
app.setAppUserModelId('com.starscout.tray'); // Windows Toast通知に必要

// パッケージ版はapp.asarが読み取り専用のため、config.jsonはOS標準のuserDataディレクトリに保存する
// (開発モードは従来通りpackages/tray/data/配下でリポジトリ内完結させる)
const configDir = app.isPackaged ? app.getPath('userData') : join(__dirname, '..', 'data');
const configPath = join(configDir, 'config.json');
const config = loadConfig(configPath);

let tray;
let stopPolling;

function iconFor(status) {
  return nativeImage.createFromBuffer(createStatusIconPng(status, 32));
}

// SS-027: 集約通知は件数のみで個別サイト名を省略するため、クリックでダッシュボードを開き
// 全件・DOWN理由まで確認できる導線を用意する(個別通知でも同じ導線で統一する)
function notify(title, body) {
  const notification = new Notification({ title, body });
  notification.on('click', () => shell.openExternal(config.serverUrl));
  notification.show();
}

// FR-009/FR-010/FR-010a: DOWN/RECOVERED/WARNINGのそれぞれをWindows Toastで通知する
// SS-024: 同一tickで多数のイベントが同時発生した場合はbuildNotificationPlanが1件のサマリに
// まとめてくれるため、ここでの呼び出し回数(=ネイティブ通知APIの同期呼び出し回数)は抑えられる
// SS-028/SS-030: トレイ設定のグローバル方式(config.notificationMode)と、
// ダッシュボードで設定したサイト単位の方式(event.target.notificationMode)の両方を
// buildNotificationPlanに渡し、優先順位付きで振り分けさせる
function handleEvents(events) {
  for (const { title, body } of buildNotificationPlan(events, { globalMode: config.notificationMode })) {
    notify(title, body);
  }
}

// SS-028: トレイメニューから通知方式(集約優先/常に個別)を選べるようにする
function setNotificationMode(mode) {
  if (config.notificationMode === mode) return;
  config.notificationMode = mode;
  saveConfig(configPath, config);
  tray.setContextMenu(buildMenu());
}

function buildMenu() {
  return Menu.buildFromTemplate([
    { label: 'ダッシュボードを開く', click: () => shell.openExternal(config.serverUrl) },
    { type: 'separator' },
    {
      label: '通知方式',
      submenu: [
        {
          label: '集約優先(件数が多い時はまとめる)',
          type: 'radio',
          checked: config.notificationMode !== 'individual',
          click: () => setNotificationMode('aggregate'),
        },
        {
          label: '常に個別通知',
          type: 'radio',
          checked: config.notificationMode === 'individual',
          click: () => setNotificationMode('individual'),
        },
      ],
    },
    // SS-011: 実際に監視対象を落とさなくても通知の見た目を体験できるようにする
    { label: 'テスト通知を送る', click: () => playTestNotificationScenario((event) => handleEvents([event])) },
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
