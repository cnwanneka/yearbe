
const pool = require("../database/db");
const { cjRequest } = require("./cjApi");

async function syncCJCategories() {
  let client;
  let imported = 0;

  try {
    console.log("Fetching CJ categories...");

    const categories = await cjRequest(
      "/product/getCategory"
    );

    if (!Array.isArray(categories)) {
      throw new Error("Invalid category response");
    }

    client = await pool.connect();
    await client.query("BEGIN");

    for (const group of categories) {
      for (const parent of group.categoryFirstList || []) {
        for (const category of parent.categorySecondList || []) {

          if (!category.categoryId ||
              !category.categoryName ||
              !group.categoryFirstName) {
            continue;
          }

          await client.query(`
            INSERT INTO cj_categories (
              category_id,
              category_name,
              parent_name,
              group_name
            )
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (category_id)
            DO UPDATE SET
              category_name = EXCLUDED.category_name,
              parent_name = EXCLUDED.parent_name,
              group_name = EXCLUDED.group_name,
              updated_at = NOW()
          `, [
            String(category.categoryId),
            category.categoryName,
            parent.categorySecondName,
            group.categoryFirstName
          ]);

          imported++;
        }
      }
    }

    if (imported === 0) {
      throw new Error("No categories imported");
    }

    await client.query("COMMIT");

    console.log(
      `Successfully processed ${imported} CJ categories`
    );

  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error("Category sync failed:", error.message);
    process.exitCode = 1;

  } finally {
    if (client) client.release();
    await pool.end();
  }
}

syncCJCategories();
