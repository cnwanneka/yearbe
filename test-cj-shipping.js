
const pool = require("./database/db");
const { cjRequest } = require("./services/cjApi");

async function testCJShipping() {
  try {
    const result = await pool.query(`
      SELECT
        v.cj_variant_id,
        v.sku,
        v.cost_gbp,
        v.warehouse_inventory,
        p.name
      FROM cj_variants v
      JOIN cj_products p ON p.id = v.product_id
      WHERE v.sku = 'CJYD218338401AZ'
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      throw new Error("Test variant not found");
    }

    const variant = result.rows[0];

    const chinaStock =
      Array.isArray(variant.warehouse_inventory) &&
      variant.warehouse_inventory.some(
        (warehouse) =>
          warehouse.countryCode === "CN" &&
          Number(warehouse.totalInventory) > 0
      );

    if (!chinaStock) {
      throw new Error("No reported China stock");
    }

    console.log("Product:", variant.name);
    console.log("SKU:", variant.sku);
    console.log("Supplier cost GBP:", variant.cost_gbp);
    console.log("Shipping from: China");
    console.log("Shipping to: United Kingdom");

    const shipping = await cjRequest(
      "/logistic/freightCalculate",
      "POST",
      {
        startCountryCode: "CN",
        endCountryCode: "GB",
        products: [
          {
            quantity: 1,
            vid: variant.cj_variant_id
          }
        ]
      }
    );

    if (!Array.isArray(shipping)) {
      throw new Error("Unexpected shipping response");
    }

    console.log(
      "Shipping options found:",
      shipping.length
    );

    console.table(
      shipping.map((option) => ({
        shippingMethod: option.logisticName,
        deliveryTime: option.logisticAging,
        shippingUSD: option.logisticPrice,
        taxesUSD: option.taxesFee ?? null,
        clearanceUSD:
          option.clearanceOperationFee ?? null,
        totalPostageUSD:
          option.totalPostageFee ?? null
      }))
    );

    console.log("Shipping test completed.");

  } catch (error) {
    console.error(
      "Shipping test failed:",
      error.message
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

testCJShipping();
