CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_categories_active_sort
ON categories(is_active, sort_order, label);

INSERT OR IGNORE INTO categories (slug, label, description, color, sort_order, is_active, is_builtin, created_at, updated_at)
VALUES
  ('company', '회사소개', '회사 소개, 연혁, 조직 정보 분류', '#7dd3fc', 10, 1, 1, unixepoch(), unixepoch()),
  ('legal', '법무', '계약, 규정, 준법 문서 분류', '#c084fc', 20, 1, 1, unixepoch(), unixepoch()),
  ('tech', '기술', '제품 문서, API, 운영 가이드 분류', '#4ade80', 30, 1, 1, unixepoch(), unixepoch()),
  ('hr', '인사', '복지, 인사 정책, 채용 자료 분류', '#facc15', 40, 1, 1, unixepoch(), unixepoch()),
  ('marketing', '마케팅', '전단, 보도자료, 홍보 자료 분류', '#fb7185', 50, 1, 1, unixepoch(), unixepoch());

PRAGMA optimize;
