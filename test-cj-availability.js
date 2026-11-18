
require("dotenv").config();

const pool = require("./database/db");
const { cjRequest } = require("./services/cjApi");

const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

async function checkProduct(pid, label) {
  console.log("\nTest:", label);
  console.log("CJ product ID:", pid);

  try {
    const data = await cjRequest(
      `/product/query?pid=${encodeURIComponent(pid)}`
    );

    console.table({
      productReturned: Boolean(data?.pid),
      matchingProduct: String(data?.pid) === pid,
      productName: data?.productNameEn || null,
      variants: Array.isArray(data?.variants)
        ? data.variants.length
        : null,
      saleStatus: data?.saleStatus ?? null
    });

  } catch (error) {
    console.log("CJ request failed");

    console.table({
      message: error.message,
      code: error.response?.data?.code
        ?? error.cjCode
        ?? error.code
        ?? null,
      httpStatus: error.httpStatus
        ?? error.response?.status
        ?? error.status
        ?? null
    });
  }
}

async function testCJAvailability() {
  let client;

  try {
    client = await pool.connect();

    const lock = await client.query(
      "SELECT pg_try_advisory_lock(81001) AS locked"
    );

    if (!lock.rows[0].locked) {
      throw new Error(
        "Another CJ synchronisation is already running"
      );
    }

    const result = await client.query(`
      SELECT cj_product_id, name
      FROM cj_products
      WHERE variants_synced_at IS NOT NULL
      ORDER BY id
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      throw new Error("No synchronised product found");
    }

    const product = result.rows[0];

    await checkProduct(
      String(product.cj_product_id),
      "Existing CJ product"
    );

    await sleep(2000);

    await checkProduct(
      "00000000-0000-4000-8000-000000000000",
      "Non-existent product test"
    );

    console.log("\nAvailability test completed.");
    console.log("No database records were modified.");

  } catch (error) {
    console.error("Test failed:", error.message);
    process.exitCode = 1;

  } finally {
    if (client) client.release(true);

    await pool.end();
  }
}

testCJAvailability();
