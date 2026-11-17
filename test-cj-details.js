
const pool = require("./database/db");
const { cjRequest } = require("./services/cjApi");

async function testProductDetails() {
  try {
    const result = await pool.query(
      `SELECT cj_product_id, name
       FROM cj_products
       ORDER BY id DESC
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      throw new Error("No products found in database");
    }

    const product = result.rows[0];

    console.log("Checking product:", product.name);

    const details = await cjRequest(
      `/product/query?pid=${encodeURIComponent(
        product.cj_product_id
      )}`
    );

    console.log("Product:", details.productNameEn);

    const variants = Array.isArray(details.variants)
      ? details.variants
      : [];

    console.log("Number of variants:", variants.length);

    if (variants.length > 0) {
      const variant = variants[0];

      console.log("First variant:", {
        id: variant.vid,
        sku: variant.variantSku,
        options: variant.variantKey,
        priceUSD: variant.variantSellPrice
      });
    } else {
      console.log("No variants returned.");
      console.log("Detail fields:", Object.keys(details));
    }

  } catch (error) {
    console.error("Details test failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

testProductDetails();
