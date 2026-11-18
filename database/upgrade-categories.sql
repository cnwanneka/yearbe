
CREATE TABLE IF NOT EXISTS cj_categories (
  category_id TEXT PRIMARY KEY,
  category_name TEXT NOT NULL,
  parent_name TEXT,
  group_name TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cj_categories_group
ON cj_categories(group_name);
