
require("dotenv").config();

const pool = require("../database/db");
const { cjRequest } = require("./cjApi");

const BATCH_SIZE = 10;

const sleep = (ms) =>
  new Promise(resolve => setTimeout(resolve, ms));

async function syncCJVariants() {
  let completed = 0;

  try {
    const result = await pool.query(
      `SELECT id, cj_product_id, name
       FROM cj_products
       WHERE variants_synced_at IS NULL
       ORDER BY id
       LIMIT $1`,
      [BATCH_SIZE]
    );

    console.log(`Products to process: ${result.rows.length}`);

    for (const product of result.rows) {
      let client;

      try {
        console.log(`Fetching: ${product.name}`);

        const details = await cjRequest(
          `/product/query?pid=${encodeURIComponent(
            product.cj_product_id
          )}`
        );

        if (!Array.isArray(details?.variants)) {
          throw new Error("Invalid variant response");
        }

        client = await pool.connect();
        await client.query("BEGIN");

        let saved = 0;

        for (const variant of details.variants) {
          if (!variant.vid) continue;

          const raw = variant.variantSellPrice;

          const price =
            raw === null || raw === undefined || raw === ""
              ? null
              : Number(raw);

          if (
            price !== null &&
            (!Number.isFinite(price) || price < 0)
          ) {
            throw new Error("Invalid supplier price");
          }

          await client.query(
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

        await client.query(
          `UPDATE cj_products
           SET variants_synced_at = NOW()
           WHERE id = $1`,
          [product.id]
        );

        await client.query("COMMIT");

        completed++;
        console.log(`Saved ${saved} variants`);

      } catch (error) {
        if (client) {
          await client.query("ROLLBACK").catch(() => {});
        }
        throw new Error(
          `Product ${product.cj_product_id}: ${error.message}`
        );
      } finally {
        if (client) client.release();

        // Conservative spacing for CJ API requests
        await sleep(1500);
      }
    }

    console.log(`Completed ${completed} products`);

  } catch (error) {
    console.error("Synchronisation stopped:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

syncCJVariants();
