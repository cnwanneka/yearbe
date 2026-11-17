
require("dotenv").config();

const pool = require("../database/db");
const { cjRequest } = require("./cjApi");

async function importCJVariants() {
  try {
    const result = await pool.query(
      `SELECT id, cj_product_id, name
       FROM cj_products
       ORDER BY id DESC
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      throw new Error("No CJ products found");
    }

    const product = result.rows[0];

    console.log("Fetching variants for:", product.name);

    const details = await cjRequest(
      `/product/query?pid=${encodeURIComponent(
        product.cj_product_id
      )}`
    );

    const variants = details.variants;

    if (!Array.isArray(variants)) {
      throw new Error("No valid variants returned");
    }

    console.log(`Found ${variants.length} variants`);

    let saved = 0;

    for (const variant of variants) {
      if (!variant.vid) continue;

      const rawPrice = variant.variantSellPrice;

      const price =
        rawPrice === null ||
        rawPrice === undefined ||
        rawPrice === ""
          ? null
          : Number(rawPrice);

      if (
        price !== null &&
        (!Number.isFinite(price) || price < 0)
      ) {
        throw new Error("Invalid supplier price");
      }

      await pool.query(
        `INSERT INTO cj_variants
         (product_id, cj_variant_id, sku,
          variant_key, supplier_price_usd,
          variant_image_url)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (cj_variant_id)
         DO UPDATE SET
           product_id = EXCLUDED.product_id,
           sku = EXCLUDED.sku,
           variant_key = EXCLUDED.variant_key,
           supplier_price_usd =
             EXCLUDED.supplier_price_usd,
           variant_image_url =
             EXCLUDED.variant_image_url,
           updated_at = CURRENT_TIMESTAMP`,
        [
          product.id,
          String(variant.vid),
          variant.variantSku || null,
          variant.variantKey || null,
          price,
          variant.variantImage || null
        ]
      );

      saved++;
    }

    console.log(`Successfully saved ${saved} variants`);
  } catch (error) {
    console.error("Variant import failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

importCJVariants();
