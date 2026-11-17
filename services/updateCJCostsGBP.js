
require("dotenv").config();

const pool = require("../database/db");

async function updateCJCostsGBP() {
  let client;

  try {
    // Fetch the latest available reference rate
    const response = await fetch(
      "https://api.frankfurter.dev/v2/rate/USD/GBP"
    );

    if (!response.ok) {
      throw new Error("Exchange-rate request failed");
    }

    const data = await response.json();
    const rate = Number(data.rate);

    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error("Invalid USD to GBP rate");
    }

    console.log(`USD to GBP rate: ${rate}`);

    client = await pool.connect();

    await client.query("BEGIN");

    const result = await client.query(
      `UPDATE cj_variants
       SET cost_gbp =
             ROUND(supplier_price_usd * $1::numeric, 2),
           usd_to_gbp_rate = $1,
           cost_gbp_updated_at = NOW()
       WHERE supplier_price_usd IS NOT NULL
         AND supplier_price_usd > 0`,
      [rate]
    );

    await client.query("COMMIT");

    console.log(
      `Updated GBP costs for ${result.rowCount} variants`
    );

  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error("GBP update failed:", error.message);
    process.exitCode = 1;

  } finally {
    if (client) client.release();
    await pool.end();
  }
}

updateCJCostsGBP();
