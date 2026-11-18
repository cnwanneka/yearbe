ALTER TABLE cj_products
ADD COLUMN IF NOT EXISTS
  last_catalogue_seen_at TIMESTAMPTZ;