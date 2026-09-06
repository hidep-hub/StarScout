export function createIncidentsRepository(db) {
  const openStmt = db.prepare(`
    INSERT INTO incidents (target_id, started_at, reason)
    VALUES (@targetId, @startedAt, @reason)
  `);

  const closeStmt = db.prepare(`
    UPDATE incidents
    SET recovered_at = @recoveredAt,
        duration_sec = CAST(ROUND((julianday(@recoveredAt) - julianday(started_at)) * 86400) AS INTEGER)
    WHERE id = @id
  `);

  const findOpenByTargetStmt = db.prepare(`
    SELECT * FROM incidents
    WHERE target_id = @targetId AND recovered_at IS NULL
    ORDER BY started_at DESC
    LIMIT 1
  `);

  const findByTargetStmt = db.prepare(`
    SELECT * FROM incidents
    WHERE target_id = @targetId
    ORDER BY started_at DESC
    LIMIT @limit OFFSET @offset
  `);

  return {
    // 障害開始を記録し、作成したincidentを返す
    open(targetId, startedAt, reason = null) {
      openStmt.run({ targetId, startedAt, reason });
      const id = Number(db.prepare('SELECT last_insert_rowid() AS id').get().id);
      return db.prepare('SELECT * FROM incidents WHERE id = ?').get(id);
    },

    // 進行中のincidentを復旧時刻でクローズする
    close(id, recoveredAt) {
      closeStmt.run({ id, recoveredAt });
      return db.prepare('SELECT * FROM incidents WHERE id = ?').get(id);
    },

    findOpenByTarget(targetId) {
      return findOpenByTargetStmt.get({ targetId }) ?? null;
    },

    findByTarget(targetId, { limit = 50, offset = 0 } = {}) {
      return findByTargetStmt.all({ targetId, limit, offset });
    },
  };
}
