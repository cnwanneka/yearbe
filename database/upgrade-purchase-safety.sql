
CREATE OR REPLACE VIEW cj_variant_purchase_readiness AS
SELECT
  p.id AS product_id,
  p.name AS product_name,
  p.status AS product_status,
  p.availability_state,

  v.id AS variant_id,
  v.sku,
  v.supplier_price_usd,
  v.cost_gbp,
  v.cj_stock_quantity,
  v.factory_stock_quantity,
  v.reported_stock_quantity,

  CASE

    WHEN p.availability_state = 'not_found'
      THEN 'product_not_found'

    WHEN p.availability_state IS DISTINCT FROM 'found'
      THEN 'availability_unverified'

    WHEN p.availability_checked_at IS NULL
      OR p.availability_checked_at <
         NOW() - INTERVAL '24 hours'
      THEN 'availability_outdated'

    WHEN p.variants_synced_at IS NULL
      OR p.variants_synced_at <
         NOW() - INTERVAL '24 hours'
      THEN 'variant_data_outdated'

    WHEN v.variant_availability_state = 'missing_review'
      THEN 'variant_missing'

    WHEN v.variant_availability_state IS DISTINCT FROM 'found'
      THEN 'variant_unverified'

    WHEN v.variant_availability_checked_at IS NULL
      OR v.variant_availability_checked_at <
        NOW() - INTERVAL '24 hours'
      THEN 'variant_availability_outdated'

    WHEN v.supplier_price_usd IS NULL
      OR v.supplier_price_usd <= 0
      THEN 'invalid_supplier_price'

    WHEN v.cost_gbp IS NULL
      OR v.cost_gbp <= 0
      THEN 'invalid_gbp_cost'

    WHEN v.cost_gbp_updated_at IS NULL
      OR v.cost_gbp_updated_at <
         NOW() - INTERVAL '24 hours'
      OR v.cost_gbp_updated_at <
         p.variants_synced_at
      THEN 'gbp_cost_outdated'

    WHEN v.stock_checked_at IS NULL
      OR v.stock_checked_at <
         NOW() - INTERVAL '24 hours'
      THEN 'inventory_outdated'

    WHEN v.reported_stock_quantity IS NULL
      THEN 'unknown_stock'

    WHEN v.reported_stock_quantity <= 0
      THEN 'out_of_stock'

    WHEN COALESCE(v.cj_stock_quantity, 0) <= 0
      THEN 'supplier_stock_review'

    ELSE 'preliminary_checks_passed'

  END AS readiness_state

FROM cj_variants v

JOIN cj_products p
  ON p.id = v.product_id;
