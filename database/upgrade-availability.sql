ALTER TABLE cj_products
ADD COLUMN IF NOT EXISTS
  availability_state TEXT NOT NULL DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS
  availability_checked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS
  availability_not_found_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS
  availability_error_code TEXT;