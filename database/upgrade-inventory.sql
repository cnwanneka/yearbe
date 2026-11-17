
ALTER TABLE cj_variants
ADD COLUMN IF NOT EXISTS cj_stock_quantity BIGINT,
ADD COLUMN IF NOT EXISTS factory_stock_quantity BIGINT,
ADD COLUMN IF NOT EXISTS reported_stock_quantity BIGINT,
ADD COLUMN IF NOT EXISTS warehouse_inventory JSONB,
ADD COLUMN IF NOT EXISTS stock_checked_at TIMESTAMPTZ;

ALTER TABLE cj_products
ADD COLUMN IF NOT EXISTS inventory_synced_at TIMESTAMPTZ;
