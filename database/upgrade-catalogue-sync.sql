
CREATE TABLE IF NOT EXISTS cj_catalogue_sync (
  category_id TEXT PRIMARY KEY
    REFERENCES cj_categories(category_id),

  next_page INTEGER NOT NULL DEFAULT 1,

  total_pages INTEGER,

  products_processed INTEGER NOT NULL DEFAULT 0,

  status TEXT NOT NULL DEFAULT 'pending',

  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO cj_catalogue_sync (category_id)
SELECT category_id
FROM cj_categories
ON CONFLICT (category_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_cj_variants_product
ON cj_variants(product_id);
