
require("dotenv").config();

const pool = require("../database/db");
const { cjRequest } = require("./cjApi");

const PAGE_SIZE = 20;
const MAX_PAGES = 2;

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function importCJProductsV2() {
  let processed = 0;

  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      console.log(`Fetching CJ V2 page ${page}...`);

      const data = await cjRequest(
        `/product/listV2?page=${page}&size=${PAGE_SIZE}`
      );

      if (!Array.isArray(data?.content)) {
        throw new Error("Unexpected CJ V2 response");
      }

      const products = data.content.flatMap((group) =>
        Array.isArray(group.productList)
          ? group.productList
          : []
      );

      console.log(`Received ${products.length} products`);

      if (products.length === 0) break;

      for (const product of products) {
        if (!product.id || !product.nameEn) {
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
            String(product.id),
            product.nameEn,
            null,
            product.categoryId || null,
            product.bigImage || null
          ]
        );

        processed++;
      }

      console.log(`Page ${page} saved successfully`);

      if (page >= Number(data.totalPages)) {
        break;
      }

      if (page < MAX_PAGES) {
        await sleep(1200);
      }
    }

    console.log(
      `Finished: ${processed} CJ V2 products processed`
    );
  } catch (error) {
    console.error("V2 import failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

importCJProductsV2();
