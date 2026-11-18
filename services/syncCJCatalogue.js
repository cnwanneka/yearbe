
const pool = require("../database/db");
const { cjRequest } = require("./cjApi");

const PAGE_SIZE = 100;

const REFRESH_DAYS = 7;

const MAX_REQUESTS = Math.min(
  150,
  Math.max(
    1,
    parseInt(
      process.env.CJ_CATALOGUE_MAX_REQUESTS || "50",
      10
    ) || 50
  )
);

const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

async function syncCJCatalogue() {
  let client;
  let locked = false;
  let processed = 0;
  let requests = 0;

  try {
    client = await pool.connect();

    // Prevent overlapping synchronisation services
    const lock = await client.query(`
      SELECT pg_try_advisory_lock(81001) AS locked
    `);

    locked = lock.rows[0].locked;

    if (!locked) {
      throw new Error(
        "Another CJ synchronisation is already running"
      );
    }

    // Add any newly imported categories to the queue
    await client.query(`
      INSERT INTO cj_catalogue_sync (category_id)
      SELECT category_id
      FROM cj_categories
      ON CONFLICT (category_id) DO NOTHING
    `);

    while (requests < MAX_REQUESTS) {

      // Prioritise unfinished categories,
      // followed by completed categories due for refresh
      const queue = await client.query(`
        SELECT
          s.category_id,
          CASE
            WHEN s.status = 'completed' THEN 1
            ELSE s.next_page
          END AS next_page,
          s.status,
          c.category_name,
          c.group_name
        FROM cj_catalogue_sync s
        JOIN cj_categories c
          ON c.category_id = s.category_id
        WHERE s.status IN ('pending', 'in_progress')
          OR (
            s.status = 'completed'
            AND s.updated_at <= NOW() -
              ($1::integer * INTERVAL '1 day')
          )
        ORDER BY
          CASE
            WHEN s.status = 'in_progress' THEN 0
            WHEN s.status = 'pending' THEN 1
            ELSE 2
          END,
          CASE
            WHEN s.status = 'completed'
            THEN s.updated_at
          END ASC,
          c.group_name,
          c.category_name,
          s.category_id
        LIMIT 1
      `, [REFRESH_DAYS]);

      if (queue.rows.length === 0) {
        console.log(
          "No standard categories currently due"
        );
        break;
      }

      const job = queue.rows[0];

      console.log(
        job.status === "completed"
          ? `Refreshing ${job.category_name}, page ${job.next_page}`
          : `Fetching ${job.category_name}, page ${job.next_page}`
      );

      const params = new URLSearchParams({
        page: String(job.next_page),
        size: String(PAGE_SIZE),
        categoryId: job.category_id,
        orderBy: "3",
        sort: "asc"
      });

      requests++;

      const data = await cjRequest(
        `/product/listV2?${params}`
      );

      if (!Array.isArray(data?.content)) {
        throw new Error(
          "Invalid CJ catalogue response"
        );
      }

      const totalPages = Number(data.totalPages);
      const totalRecords = Number(data.totalRecords);

      if (
        data.totalPages == null ||
        data.totalRecords == null ||
        !Number.isInteger(totalPages) ||
        totalPages < 0 ||
        !Number.isInteger(totalRecords) ||
        totalRecords < 0 ||
        Number(data.pageNumber) !== job.next_page
      ) {
        throw new Error("Invalid pagination response");
      }

      if (!data.content.every(group =>
        Array.isArray(group.productList)
      )) {
        throw new Error("Invalid CJ product list");
      }

      const products = data.content.flatMap(
        group => group.productList
      );

      console.log(
        `Received ${products.length} products`
      );

      if (
        products.length === 0 &&
        totalRecords > 0
      ) {
        throw new Error(
          "Unexpected empty page. Check CJ pagination."
        );
      }

      await client.query("BEGIN");

      let saved = 0;

      for (const product of products) {

        if (!product.id || !product.nameEn) {
          throw new Error(
            "Product is missing its ID or English name"
          );
        }

        await client.query(`
          INSERT INTO cj_products (
            cj_product_id,
            name,
            category_id,
            image_url,
            status,
            last_catalogue_seen_at
          )
          VALUES ($1, $2, $3, $4, 'draft', NOW())

          ON CONFLICT (cj_product_id)
          DO UPDATE SET
            name = EXCLUDED.name,
            category_id = EXCLUDED.category_id,
            image_url = EXCLUDED.image_url,
            last_catalogue_seen_at =
              EXCLUDED.last_catalogue_seen_at,
            updated_at = CURRENT_TIMESTAMP
        `, [
          String(product.id),
          product.nameEn,
          product.categoryId || job.category_id,
          product.bigImage || null
        ]);

        saved++;
      }

      const finished =
        job.next_page >= totalPages ||
        totalRecords === 0;

      let status = "in_progress";

      if (finished) {
        status = totalRecords >= 6000
          ? "needs_partition"
          : "completed";
      }

      // Save progress and reset the category counter
      // when starting a new refresh cycle
      await client.query(`
        UPDATE cj_catalogue_sync
        SET
          scan_started_at =
            CASE
              WHEN $2 = 2 THEN NOW()
              ELSE scan_started_at
            END,
          next_page = $2,
          total_pages = $3,
          products_processed =
            CASE
              WHEN status = 'completed' THEN $4
              ELSE products_processed + $4
            END,
          status = $5,
          updated_at = NOW()
        WHERE category_id = $1
      `, [
        job.category_id,
        job.next_page + 1,
        totalPages,
        saved,
        status
      ]);

      await client.query("COMMIT");

      processed += saved;

      console.log(
        `Page saved: ${saved} products`
      );

      console.log("Category status:", status);

      // Conservative spacing for CJ API requests
      if (requests < MAX_REQUESTS) {
        await sleep(2000);
      }
    }

    const count = await client.query(`
      SELECT COUNT(*) AS total
      FROM cj_products
    `);

    console.log("-------------------------");
    console.log("API requests:", requests);
    console.log("Products processed:", processed);
    console.log("Total catalogue:", count.rows[0].total);
    console.log("Catalogue refresh interval:",
      REFRESH_DAYS, "days");
    console.log("Progress saved successfully.");
    console.log("All newly imported products are drafts.");

  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error(
      "Catalogue sync failed:",
      error.message
    );

    console.log(
      "Previously completed pages remain saved."
    );

    process.exitCode = 1;

  } finally {
    if (client) {
      if (locked) {
        await client.query(
          "SELECT pg_advisory_unlock(81001)"
        ).catch(() => {});
      }

      client.release(true);
    }

    await pool.end();
  }
}

syncCJCatalogue();

