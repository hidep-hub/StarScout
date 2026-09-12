import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, saveConfig } from '../src/config.js';

function tempConfigPath() {
  const dir = mkdtempSync(join(tmpdir(), 'starscout-tray-config-'));
  return join(dir, 'config.json');
}

test('loadConfig creates a default config file (including notificationMode) when missing', () => {
  const configPath = tempConfigPath();
  const config = loadConfig(configPath);

  assert.equal(config.serverUrl, 'http://localhost:3300');
  assert.equal(config.notificationMode, 'aggregate');

  const onDisk = JSON.parse(readFileSync(configPath, 'utf8'));
  assert.equal(onDisk.notificationMode, 'aggregate');

  rmSync(configPath, { force: true });
});

test('loadConfig merges an existing partial config with defaults', () => {
  const configPath = tempConfigPath();
  saveConfig(configPath, { serverUrl: 'http://example.com', notificationMode: 'individual' });

  const config = loadConfig(configPath);
  assert.equal(config.serverUrl, 'http://example.com');
  assert.equal(config.notificationMode, 'individual');
  assert.equal(config.pollIntervalMs, 5000);

  rmSync(configPath, { force: true });
});

test('saveConfig persists changes so a subsequent loadConfig sees them', () => {
  const configPath = tempConfigPath();
  const config = loadConfig(configPath);

  config.notificationMode = 'individual';
  saveConfig(configPath, config);

  const reloaded = loadConfig(configPath);
  assert.equal(reloaded.notificationMode, 'individual');

  rmSync(configPath, { force: true });
});
