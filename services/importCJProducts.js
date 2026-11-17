
require("dotenv").config();

const pool = require("../database/db");
const { cjRequest } = require("./cjApi");

const PAGE_SIZE = 20;
const MAX_PAGES = 2; // Test two pages first

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function importCJProducts() {
  let imported = 0;

  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      console.log(`Fetching CJ page ${page}...`);

      const data = await cjRequest(
        `/product/list?pageNum=${page}&pageSize=${PAGE_SIZE}`
      );

      if (!Array.isArray(data?.list)) {
        throw new Error("Unexpected CJ product response");
      }

      const products = data.list;

      console.log(`Received ${products.length} products`);

      if (products.length === 0) break;

      for (const product of products) {
        if (!product.pid || !product.productNameEn) {
          continue;
        }

        await pool.query(
          `INSERT INTO cj_products
           (cj_product_id, name, description,
            category_id, image_url, status)
           VALUES ($1, $2, $3, $4, $5, 'draft')
           ON CONFLICT (cj_product_id)
           DO UPDATE SET
             name = EXCLUDED.name,
             category_id = EXCLUDED.category_id,
             image_url = EXCLUDED.image_url,
             updated_at = CURRENT_TIMESTAMP`,
          [
            product.pid,
            product.productNameEn,
            null,
            product.categoryId,
            product.productImage
          ]
        );

        imported++;
      }

      console.log(`Page ${page} saved successfully`);

      if (page * PAGE_SIZE >= Number(data.total)) {
        break;
      }

      // Keep requests below the free-tier rate limit
      await sleep(1200);
    }

    console.log(
      `Finished: ${imported} products processed`
    );
  } catch (error) {
    console.error("Import failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

importCJProducts();

