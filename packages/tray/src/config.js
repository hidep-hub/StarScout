import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// Server⇔Tray通信はREST/HTTPポーリング(docs/00_requirements/02_architecture_draft.md「10.」)。
// 個人利用では同一PC上のServerに既定で接続する。
const DEFAULT_CONFIG = {
  serverUrl: 'http://localhost:3300',
  pollIntervalMs: 5000,
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
