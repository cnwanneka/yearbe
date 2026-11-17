
const pool = require("./database/db");
const { cjRequest } = require("./services/cjApi");

async function testCJStock() {
  try {
    const result = await pool.query(`
      SELECT
        v.cj_variant_id,
        v.sku,
        p.name
      FROM cj_variants v
      JOIN cj_products p ON p.id = v.product_id
      ORDER BY v.id
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      throw new Error("No variants found");
    }

    const variant = result.rows[0];

    console.log("Product:", variant.name);
    console.log("SKU:", variant.sku);

    const inventory = await cjRequest(
      `/product/stock/queryByVid?vid=${
        encodeURIComponent(variant.cj_variant_id)
      }`
    );

    if (!Array.isArray(inventory)) {
      throw new Error("Unexpected inventory response");
    }

    console.log("Warehouses found:", inventory.length);

    console.table(
      inventory.map((warehouse) => ({
        country: warehouse.countryCode,
        warehouse: warehouse.areaEn,
        totalStock: warehouse.totalInventoryNum,
        cjStock: warehouse.cjInventoryNum,
        factoryStock: warehouse.factoryInventoryNum
      }))
    );

    console.log("Inventory test completed.");

  } catch (error) {
    console.error("Inventory test failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

testCJStock();
