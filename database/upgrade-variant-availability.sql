
ALTER TABLE cj_variants
ADD COLUMN IF NOT EXISTS
  variant_availability_state TEXT NOT NULL DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS
  variant_last_seen_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS
  variant_availability_checked_at TIMESTAMPTZ;
