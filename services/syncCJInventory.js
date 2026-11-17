
const pool = require("../database/db");
const { cjRequest } = require("./cjApi");

const BATCH_SIZE = 15;

const sleep = (ms) =>
  new Promise(resolve => setTimeout(resolve, ms));

function sumStock(rows, field) {
  if (rows.length === 0) return null;

  let total = 0;

  for (const row of rows) {
    const raw = row[field];

    if (raw == null || raw === "") return null;

    const value = Number(raw);

    if (!Number.isSafeInteger(value) || value < 0) {
      return null;
    }

    total += value;
  }

  return total;
}

async function syncCJInventory() {
  let completed = 0;

  try {
    const result = await pool.query(`
      SELECT id, cj_product_id, name
      FROM cj_products
      WHERE variants_synced_at IS NOT NULL
        AND inventory_synced_at IS NULL
      ORDER BY id
      LIMIT $1
    `, [BATCH_SIZE]);

    console.log(
      `Products to check: ${result.rows.length}`
    );

    for (const product of result.rows) {
      console.log("Checking:", product.name);

      const data = await cjRequest(
        `/product/stock/getInventoryByPid?pid=${
          encodeURIComponent(product.cj_product_id)
        }`
      );

      if (!Array.isArray(data?.variantInventories)) {
        throw new Error("Invalid inventory response");
      }

      if (data.variantInventories.length === 0) {
        throw new Error("No variant inventory returned");
      }

      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        let updated = 0;

        for (const variant of data.variantInventories) {
          if (!variant.vid ||
              !Array.isArray(variant.inventory)) {
            continue;
          }

          const inventory = variant.inventory;

          const cjStock =
            sumStock(inventory, "cjInventory");

          const factoryStock =
            sumStock(inventory, "factoryInventory");

          const totalStock =
            sumStock(inventory, "totalInventory");

          const saved = await client.query(`
            UPDATE cj_variants
            SET cj_stock_quantity = $1,
                factory_stock_quantity = $2,
                reported_stock_quantity = $3,
                warehouse_inventory = $4::jsonb,
                stock_checked_at = NOW()
            WHERE cj_variant_id = $5
              AND product_id = $6
          `, [
            cjStock,
            factoryStock,
            totalStock,
            JSON.stringify(inventory),
            String(variant.vid),
            product.id
          ]);

          updated += saved.rowCount;
        }

        if (updated === 0) {
          throw new Error("No matching variants updated");
        }

        await client.query(`
          UPDATE cj_products
          SET inventory_synced_at = NOW()
          WHERE id = $1
        `, [product.id]);

        await client.query("COMMIT");

        completed++;

        console.log(
          `Inventory saved for ${updated} variants`
        );

      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }

      await sleep(1500);
    }

    console.log(
      `Completed inventory for ${completed} products`
    );

  } catch (error) {
    console.error("Inventory sync stopped:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

syncCJInventory();
