import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// Server⇔Tray通信はREST/HTTPポーリング(docs/00_requirements/02_architecture_draft.md「10.」)。
// 個人利用では同一PC上のServerに既定で接続する。
// SS-028: notificationModeは'aggregate'(既定、多件は集約) or 'individual'(常に個別通知)。
const DEFAULT_CONFIG = {
  serverUrl: 'http://localhost:3300',
  pollIntervalMs: 5000,
  notificationMode: 'aggregate',
};

export function loadConfig(configPath) {
  if (!existsSync(configPath)) {
    mkdirSync(dirname(configPath), { recursive: true });
    writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
    return { ...DEFAULT_CONFIG };
  }

  const raw = JSON.parse(readFileSync(configPath, 'utf8'));
  return { ...DEFAULT_CONFIG, ...raw };
}

// SS-028: トレイメニューから通知方式を切り替えた際に、設定を永続化する
export function saveConfig(configPath, config) {
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}
