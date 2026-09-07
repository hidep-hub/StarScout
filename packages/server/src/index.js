import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStorage } from './db/index.js';
import { createMonitorEngine } from './monitor/engine.js';
import { createRouter } from './api/router.js';
import { registerTargetRoutes } from './api/routes/targets.js';
import { registerStatusRoutes } from './api/routes/status.js';
import { createHttpServer } from './api/server.js';
import { loadConfig } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

const config = loadConfig(join(DATA_DIR, 'config.json'));
const storage = createStorage(join(DATA_DIR, 'starscout.sqlite3'));
const engine = createMonitorEngine(storage);

const router = createRouter();
registerTargetRoutes(router, storage, engine);
registerStatusRoutes(router, storage);

engine.on('error', (err) => console.error('[monitor]', err));
engine.on('incident-detected', ({ target, reason }) => {
  console.log(`[incident] ${target.name} is DOWN (${reason})`);
});
engine.on('incident-recovered', ({ target }) => {
  console.log(`[incident] ${target.name} recovered`);
});
engine.on('title-changed', ({ target, from, to }) => {
  console.log(`[title-changed] ${target.name}: "${from}" -> "${to}"`);
});

const server = createHttpServer(router);
engine.start();

server.listen(config.port, () => {
  console.log(`StarScout Server listening on http://localhost:${config.port}`);
});

function shutdown() {
  server.close();
  engine.stop();
  storage.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
