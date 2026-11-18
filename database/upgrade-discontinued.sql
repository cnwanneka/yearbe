
ALTER TABLE cj_catalogue_sync
ADD COLUMN IF NOT EXISTS
  scan_started_at TIMESTAMPTZ;

CREATE OR REPLACE VIEW cj_discontinued_candidates AS
SELECT
  p.id,
  p.cj_product_id,
  p.name,
  p.category_id,
  p.status,
  p.last_catalogue_seen_at,
  s.scan_started_at,
  s.updated_at AS category_completed_at
FROM cj_products p
JOIN cj_catalogue_sync s
  ON s.category_id = p.category_id
WHERE p.last_catalogue_seen_at IS NOT NULL
  AND s.status = 'completed'
  AND s.scan_started_at > p.last_catalogue_seen_at
  AND p.last_catalogue_seen_at <=
      NOW() - INTERVAL '14 days';
