-- Phase2: Page Title変更検知・Keywordチェック
ALTER TABLE targets ADD COLUMN keyword TEXT;
ALTER TABLE target_state ADD COLUMN last_page_title TEXT;
ALTER TABLE target_state ADD COLUMN title_changed_at TEXT;
