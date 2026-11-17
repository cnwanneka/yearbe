
ALTER TABLE cj_products
ADD COLUMN IF NOT EXISTS variants_synced_at TIMESTAMPTZ;
