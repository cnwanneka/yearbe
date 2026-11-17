
const pool = require("./database/db");
const { getProductQuote } = require("./services/cjPricing");

async function testPriceQuote() {
  try {
    const quote = await getProductQuote({
      sku: process.argv[5] || "CJYD218338401AZ",
      destination: process.argv[2] || "GB",
      preferredMethod: process.argv[3] || "",
      quantity: Number(process.argv[4] || 1)
    });

    console.table(quote);

    console.log("Preview only. No prices published.");

  } catch (error) {
    console.error("Pricing test failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

testPriceQuote();

