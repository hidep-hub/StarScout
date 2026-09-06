import { openDatabase } from './connection.js';
import { createTargetsRepository } from './repositories/targetsRepository.js';
import { createStateRepository } from './repositories/stateRepository.js';
import { createIncidentsRepository } from './repositories/incidentsRepository.js';
import { createHistoryRepository } from './repositories/historyRepository.js';

export function createStorage(dbPath) {
  const db = openDatabase(dbPath);

  return {
    db,
    targets: createTargetsRepository(db),
    state: createStateRepository(db),
    incidents: createIncidentsRepository(db),
    history: createHistoryRepository(db),
    close() {
      db.close();
    },
  };
}
