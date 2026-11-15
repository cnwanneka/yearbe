
CREATE TABLE IF NOT EXISTS cj_products (
    id SERIAL PRIMARY KEY,
    cj_product_id VARCHAR(100) UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category_id VARCHAR(100),
    image_url TEXT,
    status VARCHAR(30) DEFAULT 'draft',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cj_variants (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES cj_products(id)
        ON DELETE CASCADE,
    cj_variant_id VARCHAR(100) UNIQUE NOT NULL,
    sku VARCHAR(150),
    cost_gbp NUMERIC(12,2),
    selling_price_gbp NUMERIC(12,2),
    stock_quantity INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cj_products_category
ON cj_products(category_id);

CREATE INDEX IF NOT EXISTS idx_cj_products_status
ON cj_products(status);

