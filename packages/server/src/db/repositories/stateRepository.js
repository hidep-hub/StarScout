const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

const UPDATABLE_COLUMNS = {
  status: 'status',
  consecutiveFailures: 'consecutive_failures',
  incidentStartAt: 'incident_start_at',
  recoveredAt: 'recovered_at',
  lastCheckedAt: 'last_checked_at',
  lastHttpStatus: 'last_http_status',
  lastResponseTimeMs: 'last_response_time_ms',
  lastError: 'last_error',
};

export function createStateRepository(db) {
  const getStmt = db.prepare('SELECT * FROM target_state WHERE target_id = ?');

  return {
    get(targetId) {
      return getStmt.get(targetId) ?? null;
    },

    // patch: UPDATABLE_COLUMNSのキーのみを部分更新する。未指定のフィールドは変更しない。
    update(targetId, patch) {
      const keys = Object.keys(patch).filter((key) => key in UPDATABLE_COLUMNS);
      if (keys.length === 0) return this.get(targetId);

      const setClause = keys.map((key) => `${UPDATABLE_COLUMNS[key]} = @${key}`).join(', ');
      const stmt = db.prepare(`
        UPDATE target_state SET ${setClause}, updated_at = ${NOW}
        WHERE target_id = @targetId
      `);

      const params = { targetId };
      for (const key of keys) params[key] = patch[key] ?? null;

      stmt.run(params);
      return this.get(targetId);
    },
  };
}
