const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

export function createTargetsRepository(db) {
  const insertTargetStmt = db.prepare(`
    INSERT INTO targets (
      name, url, port, initial_page_title, enabled,
      interval_sec, timeout_sec, expected_status_pattern,
      warning_threshold_ms, warning_notify_enabled, keyword
    ) VALUES (
      @name, @url, @port, @initialPageTitle, @enabled,
      @intervalSec, @timeoutSec, @expectedStatusPattern,
      @warningThresholdMs, @warningNotifyEnabled, @keyword
    )
  `);

  const insertInitialStateStmt = db.prepare(`
    INSERT INTO target_state (target_id, status) VALUES (?, 'UNKNOWN')
  `);

  const findByIdStmt = db.prepare('SELECT * FROM targets WHERE id = ?');
  const findAllStmt = db.prepare('SELECT * FROM targets ORDER BY id');

  const updateStmt = db.prepare(`
    UPDATE targets SET
      name = @name,
      url = @url,
      port = @port,
      initial_page_title = @initialPageTitle,
      enabled = @enabled,
      interval_sec = @intervalSec,
      timeout_sec = @timeoutSec,
      expected_status_pattern = @expectedStatusPattern,
      warning_threshold_ms = @warningThresholdMs,
      warning_notify_enabled = @warningNotifyEnabled,
      keyword = @keyword,
      updated_at = ${NOW}
    WHERE id = @id
  `);

  const deleteStmt = db.prepare('DELETE FROM targets WHERE id = ?');

  return {
    create(input) {
      const params = {
        name: input.name,
        url: input.url,
        port: input.port ?? null,
        initialPageTitle: input.initialPageTitle ?? null,
        enabled: input.enabled === false ? 0 : 1,
        intervalSec: input.intervalSec ?? 60,
        timeoutSec: input.timeoutSec ?? 5,
        expectedStatusPattern: input.expectedStatusPattern ?? '2xx',
        warningThresholdMs: input.warningThresholdMs ?? 2000,
        warningNotifyEnabled: input.warningNotifyEnabled ? 1 : 0,
        keyword: input.keyword ?? null,
      };

      db.exec('BEGIN');
      try {
        insertTargetStmt.run(params);
        const id = Number(db.prepare('SELECT last_insert_rowid() AS id').get().id);
        insertInitialStateStmt.run(id);
        db.exec('COMMIT');
        return findByIdStmt.get(id);
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },

    findById(id) {
      return findByIdStmt.get(id) ?? null;
    },

    findAll() {
      return findAllStmt.all();
    },

    update(id, input) {
      const current = findByIdStmt.get(id);
      if (!current) return null;

      updateStmt.run({
        id,
        name: input.name ?? current.name,
        url: input.url ?? current.url,
        port: input.port ?? current.port,
        initialPageTitle: input.initialPageTitle ?? current.initial_page_title,
        enabled: (input.enabled ?? current.enabled) ? 1 : 0,
        intervalSec: input.intervalSec ?? current.interval_sec,
        timeoutSec: input.timeoutSec ?? current.timeout_sec,
        expectedStatusPattern: input.expectedStatusPattern ?? current.expected_status_pattern,
        warningThresholdMs: input.warningThresholdMs ?? current.warning_threshold_ms,
        warningNotifyEnabled: (input.warningNotifyEnabled ?? current.warning_notify_enabled) ? 1 : 0,
        keyword: input.keyword ?? current.keyword,
      });

      return findByIdStmt.get(id);
    },

    remove(id) {
      const result = deleteStmt.run(id);
      return result.changes > 0;
    },
  };
}
