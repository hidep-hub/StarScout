export function createHistoryRepository(db) {
  const insertStmt = db.prepare(`
    INSERT INTO check_history (target_id, checked_at, http_status, response_time_ms, result, error)
    VALUES (@targetId, @checkedAt, @httpStatus, @responseTimeMs, @result, @error)
  `);

  const findByTargetStmt = db.prepare(`
    SELECT * FROM check_history
    WHERE target_id = @targetId
    ORDER BY checked_at DESC
    LIMIT @limit OFFSET @offset
  `);

  const deleteOlderThanStmt = db.prepare(`
    DELETE FROM check_history WHERE checked_at < @before
  `);

  const getStatsStmt = db.prepare(`
    SELECT
      COUNT(*) AS count,
      AVG(response_time_ms) AS avgResponseTimeMs,
      MAX(response_time_ms) AS maxResponseTimeMs,
      MIN(response_time_ms) AS minResponseTimeMs
    FROM check_history
    WHERE target_id = @targetId AND checked_at >= @since AND response_time_ms IS NOT NULL
  `);

  return {
    insert(record) {
      insertStmt.run({
        targetId: record.targetId,
        // check_history.checked_atはNOT NULLのため、未指定時はDEFAULT任せにせずここで補完する
        checkedAt: record.checkedAt ?? new Date().toISOString(),
        httpStatus: record.httpStatus ?? null,
        responseTimeMs: record.responseTimeMs ?? null,
        result: record.result,
        error: record.error ?? null,
      });
    },

    findByTarget(targetId, { limit = 100, offset = 0 } = {}) {
      return findByTargetStmt.all({ targetId, limit, offset });
    },

    // beforeより古いISO8601日時のレコードを削除する(保持期間ポリシー用)
    deleteOlderThan(beforeIso) {
      const result = deleteOlderThanStmt.run({ before: beforeIso });
      return result.changes;
    },

    // sinceIso以降の応答時間統計(件数/平均/最大/最小)を集計する
    getStats(targetId, sinceIso) {
      const row = getStatsStmt.get({ targetId, since: sinceIso });
      return {
        count: row.count,
        avgResponseTimeMs: row.avgResponseTimeMs,
        maxResponseTimeMs: row.maxResponseTimeMs,
        minResponseTimeMs: row.minResponseTimeMs,
      };
    },
  };
}
