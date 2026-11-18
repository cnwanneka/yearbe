
const pool = require("../database/db");
const { cjRequest } = require("./cjApi");

const BATCH_SIZE = 10;

const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

async function verifyCJAvailability() {
  let client;
  let completed = 0;

  try {
    const testId = process.argv[2] || null;

    if (testId && !/^[1-9]\d*$/.test(testId)) {
      throw new Error("Invalid local product ID");
    }

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
      SELECT
        p.id,
        p.cj_product_id,
        p.name
      FROM cj_products p
      WHERE (
        (
          $1::bigint IS NOT NULL
          AND p.id = $1::bigint
        )
        OR (
          $1::bigint IS NULL
          AND (
            p.availability_state = 'not_found'
            OR EXISTS (
              SELECT 1
              FROM cj_discontinued_candidates c
              WHERE c.id = p.id
            )
          )
        )
      )
      AND (
        p.availability_checked_at IS NULL
        OR p.availability_checked_at <=
          NOW() - INTERVAL '24 hours'
      )
      ORDER BY
        p.availability_checked_at ASC NULLS FIRST,
        p.id
      LIMIT $2
    `, [testId, BATCH_SIZE]);

    console.log(
      `Products to verify: ${result.rows.length}`
    );

    for (const product of result.rows) {

      console.log("Verifying:", product.name);

      let data;
      let notFound = false;

      try {
        data = await cjRequest(
          `/product/query?pid=${
            encodeURIComponent(product.cj_product_id)
          }`
        );

      } catch (error) {
        if (
          error.stage === "request" &&
          String(error.cjCode) === "1602001" &&
          (
            error.kind === "api" ||
            (
              error.kind === "http" &&
              error.httpStatus === 404
            )
          )
        ) {
          notFound = true;

        } else {
          // Never classify temporary API errors
          // as discontinued products.
          throw error;
        }
      }

      if (notFound) {

        const saved = await client.query(`
          UPDATE cj_products
          SET
            availability_state = 'not_found',
            availability_checked_at = NOW(),
            availability_not_found_count =
              availability_not_found_count + 1,
            availability_error_code = '1602001'
          WHERE id = $1
          RETURNING availability_not_found_count
        `, [product.id]);

        const count =
          saved.rows[0].availability_not_found_count;

        console.log("Product not found.");
        console.log("Not-found responses:", count);

        if (count >= 2) {
          console.log(
            "Flagged for deactivation review."
          );
        }

      } else {

        if (
          !data?.pid ||
          String(data.pid) !==
            String(product.cj_product_id)
        ) {
          throw new Error(
            "Invalid product availability response"
          );
        }

        await client.query(`
          UPDATE cj_products
          SET
            availability_state = 'found',
            availability_checked_at = NOW(),
            availability_not_found_count = 0,
            availability_error_code = NULL
          WHERE id = $1
        `, [product.id]);

        console.log("Product found successfully.");
      }

      completed++;

      await sleep(2000);
    }

    console.log("-------------------------");
    console.log("Products verified:", completed);
    console.log("Availability verification completed.");
    console.log("No publication statuses changed.");

  } catch (error) {

    console.error(
      "Availability verification stopped:",
      error.message
    );

    console.error(
      "CJ error code:",
      error.cjCode ?? null
    );

    process.exitCode = 1;

  } finally {

    if (client) client.release(true);

    await pool.end();
  }
}

verifyCJAvailability();
