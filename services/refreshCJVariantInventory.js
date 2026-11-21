
require("dotenv").config();

const pool = require("../database/db");
const { cjRequest } = require("./cjApi");

function sumStock(rows, field) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  let total = 0;

  for (const row of rows) {
    const raw = row[field];

    if (raw == null || raw === "") {
      return null;
    }

    const value = Number(raw);

    if (
      !Number.isSafeInteger(value) ||
      value < 0
    ) {
      return null;
    }

    total += value;

    if (!Number.isSafeInteger(total)) {
      return null;
    }
  }

  return total;
}

async function refreshVariantInventory() {

  const argument = process.argv[2];

  const variantId = Number(argument);

  let client;
  let locked = false;
  let inTransaction = false;

  try {

    // Require exactly one valid variant ID
    if (
      process.argv.length !== 3 ||
      !Number.isInteger(variantId) ||
      variantId < 1 ||
      variantId > 2147483647
    ) {
      throw new Error(
        "Usage: node services/refreshCJVariantInventory.js 6"
      );
    }

    if (
      process.env.NODE_ENV === "production" ||
      process.env.YEARBE_CATALOGUE_PREVIEW !== "1"
    ) {
      throw new Error(
        "CJ development preview must be enabled"
      );
    }

    client = await pool.connect();

    // Prevent overlap with CJ scheduled sync jobs
    const lock = await client.query(
      "SELECT pg_try_advisory_lock(81001) AS locked"
    );

    if (!lock.rows[0].locked) {
      throw new Error(
        "Another CJ synchronisation is running"
      );
    }

    locked = true;

    // Retrieve the selected variant and product
    const result = await client.query(`
      SELECT
        v.id,
        v.cj_variant_id,
        v.sku,
        p.id AS product_id,
        p.cj_product_id,
        p.name
      FROM cj_variants v
      JOIN cj_products p
        ON p.id = v.product_id
      WHERE v.id = $1
        AND p.status = 'draft'
    `, [variantId]);

    if (result.rows.length !== 1) {
      throw new Error(
        "Selected CJ variant not found"
      );
    }

    const variant = result.rows[0];

    if (
      !variant.cj_product_id ||
      !variant.cj_variant_id ||
      !variant.sku
    ) {
      throw new Error(
        "CJ product identifiers are incomplete"
      );
    }

    console.log("-----------------------------");
    console.log("Refreshing CJ inventory");
    console.log("Product:", variant.name);
    console.log("Variant ID:", variant.id);
    console.log("SKU:", variant.sku);
    console.log("-----------------------------");

    // Request fresh inventory directly from CJ
    const data = await cjRequest(
      `/product/stock/getInventoryByPid?pid=${
        encodeURIComponent(variant.cj_product_id)
      }`
    );

    if (!Array.isArray(data?.variantInventories)) {
      throw new Error(
        "Invalid CJ inventory response"
      );
    }

    // Locate only the selected variant
    const matching = data.variantInventories.filter(
      item =>
        String(item.vid) ===
        String(variant.cj_variant_id)
    );

    if (matching.length !== 1) {
      throw new Error(
        "Selected variant inventory unavailable"
      );
    }

    const inventory = matching[0].inventory;

    if (
      !Array.isArray(inventory) ||
      inventory.length === 0
    ) {
      throw new Error(
        "No warehouse inventory returned"
      );
    }

    const cjStock =
      sumStock(inventory, "cjInventory");

    const factoryStock =
      sumStock(inventory, "factoryInventory");

    const totalStock =
      sumStock(inventory, "totalInventory");

    if (
      cjStock === null &&
      factoryStock === null &&
      totalStock === null
    ) {
      throw new Error(
        "CJ returned no usable stock quantities"
      );
    }

    // Update only the requested variant
    await client.query("BEGIN");
    inTransaction = true;

    const saved = await client.query(`
      UPDATE cj_variants

      SET
        cj_stock_quantity = $1,
        factory_stock_quantity = $2,
        reported_stock_quantity = $3,
        warehouse_inventory = $4::jsonb,
        stock_checked_at = NOW()

      WHERE id = $5
        AND cj_variant_id = $6

      RETURNING
        id,
        sku,
        stock_checked_at
    `, [
      cjStock,
      factoryStock,
      totalStock,
      JSON.stringify(inventory),
      variant.id,
      String(variant.cj_variant_id)
    ]);

    if (saved.rowCount !== 1) {
      throw new Error(
        "Unable to update the selected variant"
      );
    }

    await client.query("COMMIT");
    inTransaction = false;

    console.log("Inventory refresh successful");
    console.log("CJ warehouse stock:", cjStock);
    console.log("Factory stock:", factoryStock);
    console.log("Total reported stock:", totalStock);
    console.log(
      "Updated at:",
      saved.rows[0].stock_checked_at
    );
    console.log("Other variants were not updated");
    console.log("CJ payments remain disabled");

  } catch (error) {

    if (inTransaction && client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Rollback failed:",
          rollbackError.message
        );
      }
    }

    console.error(
      "Inventory refresh failed:",
      error.message
    );

    process.exitCode = 1;

  } finally {

    if (client) {

      if (locked) {
        try {
          await client.query(
            "SELECT pg_advisory_unlock(81001)"
          );
        } catch (error) {
          console.error(
            "Unable to release advisory lock:",
            error.message
          );
          process.exitCode = 1;
        }
      }

      client.release();
    }

    await pool.end();
  }
}

refreshVariantInventory();
