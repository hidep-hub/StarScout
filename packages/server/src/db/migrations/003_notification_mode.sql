-- SS-029: 監視対象ごとに通知方式(集約優先/常に個別通知)を選択できるようにする
ALTER TABLE targets ADD COLUMN notification_mode TEXT NOT NULL DEFAULT 'aggregate';
