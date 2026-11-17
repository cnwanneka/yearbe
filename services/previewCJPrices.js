
require("dotenv").config();

const pool = require("../database/db");

const TARGET_MARGIN = 0.30;

async function previewPrices() {
  try {
    const result = await pool.query(`
      SELECT
        sku,
        supplier_price_usd,
        cost_gbp
      FROM cj_variants
      WHERE cost_gbp IS NOT NULL
        AND cost_gbp > 0
      ORDER BY id
      LIMIT 10
    `);

    const prices = result.rows.map((item) => {
      const cost = Number(item.cost_gbp);

      const estimatedPrice =
        Math.ceil(
          (cost / (1 - TARGET_MARGIN)) * 100
        ) / 100;

      return {
        sku: item.sku,
        supplierCostGBP: cost,
        estimatedSellingPriceGBP: estimatedPrice
      };
    });

    console.table(prices);

    console.log(
      "Preview only. No prices saved or published."
    );
  } catch (error) {
    console.error("Pricing preview failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

previewPrices();
