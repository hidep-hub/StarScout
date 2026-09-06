import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// docs/00_requirements/02_architecture_draft.md「11. Serverポート設計」の決定に対応。
// インストール(セットアップ)時に指定した値をconfig.jsonへ書き込み、以降は起動時にそれを読む。
const DEFAULT_CONFIG = {
  port: 3300,
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
