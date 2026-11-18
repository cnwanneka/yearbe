

require("dotenv").config();

const pool = require("../database/db");
const { cjRequest } = require("./cjApi");

const BATCH_SIZE = Math.min(
  500,
  Math.max(
    1,
    parseInt(
      process.env.CJ_VARIANT_BATCH_SIZE || "20",
      10
    ) || 20
  )
);

const sleep = (ms) =>
  new Promise(resolve => setTimeout(resolve, ms));

async function syncCJVariants() {
  let completed = 0;
  let lockClient;

  try {
    lockClient = await pool.connect();

    // Prevent overlapping CJ synchronisation services
    const lock = await lockClient.query(
      "SELECT pg_try_advisory_lock(81001) AS locked"
    );

    if (!lock.rows[0].locked) {
      throw new Error(
        "Another CJ synchronisation is already running"
      );
    }

    // Select new products and products requiring refresh
    // Avoid rechecking missing products within 24 hours
    const result = await pool.query(
      `SELECT id, cj_product_id, name,
              variants_synced_at
       FROM cj_products
       WHERE (
         variants_synced_at IS NULL
         OR variants_synced_at <=
            NOW() - INTERVAL '24 hours'
       )
       AND (
         availability_state IS DISTINCT FROM 'not_found'
         OR availability_checked_at IS NULL
         OR availability_checked_at <=
            NOW() - INTERVAL '24 hours'
       )
       ORDER BY
         COALESCE(
           variants_synced_at,
           updated_at,
           NOW()
         ) ASC,
         id ASC
       LIMIT $1`,
      [BATCH_SIZE]
    );

    console.log(
      `Products to process: ${result.rows.length}`
    );

    for (const product of result.rows) {
      let client;

      try {
        console.log(
          product.variants_synced_at
            ? `Refreshing variants and prices: ${product.name}`
            : `Fetching new variants: ${product.name}`
        );

        let details;

        // Request product details from CJ
        try {
          details = await cjRequest(
            `/product/query?pid=${encodeURIComponent(
              product.cj_product_id
            )}`
          );

        } catch (error) {

          // Recognise confirmed CJ product-not-found errors
          const productNotFound =
            error.stage === "request" &&
            String(error.cjCode) === "1602001" &&
            (
              error.kind === "api" ||
              (
                error.kind === "http" &&
                error.httpStatus === 404
              )
            );

          if (!productNotFound) {
            throw error;
          }

          // Record missing product without deleting it
          const missing = await pool.query(`
            UPDATE cj_products
            SET
              availability_state = 'not_found',
              availability_checked_at = NOW(),
              availability_not_found_count =
                CASE
                  WHEN availability_state = 'not_found'
                    THEN availability_not_found_count + 1
                  ELSE 1
                END,
              availability_error_code = '1602001'
            WHERE id = $1
              AND (
                availability_state IS DISTINCT FROM 'not_found'
                OR availability_checked_at IS NULL
                OR availability_checked_at <=
                   NOW() - INTERVAL '24 hours'
              )
            RETURNING availability_not_found_count
          `, [product.id]);

          console.log(
            "Product not found:",
            product.name
          );

          if (missing.rows.length > 0) {
            const count =
              missing.rows[0].availability_not_found_count;

            console.log(
              "Not-found responses:",
              count
            );

            if (count >= 2) {
              console.log(
                "Flagged for deactivation review."
              );
            }
          }

          console.log(
            "Continuing to next product."
          );

          continue;
        }

        // Verify that CJ returned the correct product
        if (
          !details?.pid ||
          String(details.pid) !==
            String(product.cj_product_id)
        ) {
          throw new Error(
            "Invalid product availability response"
          );
        }

        // Validate the variant response
        if (!Array.isArray(details?.variants)) {
          throw new Error(
            "Invalid variant response"
          );
        }

        client = await pool.connect();

        await client.query("BEGIN");

        let saved = 0;

        // Import or refresh product variants
        for (const variant of details.variants) {
          if (!variant.vid) continue;

          const raw = variant.variantSellPrice;

          const price =
            raw === null ||
            raw === undefined ||
            raw === ""
              ? null
              : Number(raw);

          if (
            price !== null &&
            (
              !Number.isFinite(price) ||
              price < 0
            )
          ) {
            throw new Error(
              "Invalid supplier price"
            );
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

        // Validate the returned variant IDs
        const currentVariantIds = details.variants.map(
          variant => {
            const vid = variant?.vid;

            if (
              !vid ||
              !["string", "number"].includes(typeof vid) ||
              (
                typeof vid === "number" &&
                !Number.isSafeInteger(vid)
              )
            ) {
              throw new Error(
                "Invalid CJ variant ID"
              );
            }

            return String(vid);
          }
        );

        if (
          currentVariantIds.length === 0 ||
          new Set(currentVariantIds).size !==
            currentVariantIds.length ||
          saved !== currentVariantIds.length
        ) {
          throw new Error(
            "Incomplete or invalid CJ variant response"
          );
        }

        // Record present and potentially removed variants
        const availability = await client.query(`
          UPDATE cj_variants
          SET
            variant_availability_state =
              CASE
                WHEN cj_variant_id::text =
                     ANY($2::text[])
                  THEN 'found'
                ELSE 'missing_review'
              END,

            variant_last_seen_at =
              CASE
                WHEN cj_variant_id::text =
                     ANY($2::text[])
                  THEN NOW()
                ELSE variant_last_seen_at
              END,

            variant_availability_checked_at = NOW()

          WHERE product_id = $1

          RETURNING variant_availability_state
        `, [
          product.id,
          currentVariantIds
        ]);

        const missingVariants = availability.rows.filter(
          row =>
            row.variant_availability_state ===
            "missing_review"
        ).length;

        console.log(
          "Variants requiring removal review:",
          missingVariants
        );

        // Record successful product availability
        // and variant synchronisation
        await client.query(`
          UPDATE cj_products
          SET
            variants_synced_at = NOW(),
            availability_state = 'found',
            availability_checked_at = NOW(),
            availability_not_found_count = 0,
            availability_error_code = NULL
          WHERE id = $1
        `, [product.id]);

        // Save all changes together
        await client.query("COMMIT");

        completed++;

        console.log(
          `Saved ${saved} variants`
        );

      } catch (error) {

        if (client) {
          await client.query("ROLLBACK").catch(() => {});
        }

        throw new Error(
          `Product ${product.cj_product_id}: ${error.message}`
        );

      } finally {

        if (client) {
          client.release();
        }

        // Conservative spacing for CJ API requests
        await sleep(1500);
      }
    }

    console.log(
      `Completed ${completed} products`
    );

  } catch (error) {

    console.error(
      "Synchronisation stopped:",
      error.message
    );

    process.exitCode = 1;

  } finally {

    // Release the connection and advisory lock
    if (lockClient) {
      lockClient.release(true);
    }

    await pool.end();
  }
}

syncCJVariants();
