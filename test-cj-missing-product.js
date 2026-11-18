
const assert = require("node:assert/strict");

let missingRecorded = false;
let nextProductSaved = false;
let committed = false;

const fakePool = {
  async connect() {
    return {
      async query(sql) {
        if (sql.includes("pg_try_advisory_lock")) {
          return {
            rows: [{ locked: true }]
          };
        }

        if (sql.includes("UPDATE cj_variants")) {
          return {
            rows: [
              { variant_availability_state: "found" }
            ]
          };
        }

        if (sql.includes("UPDATE cj_products")) {
          nextProductSaved = true;
        }

        if (sql === "COMMIT") {
          committed = true;
        }

        return { rows: [], rowCount: 1 };
      },

      release() {}
    };
  },

  async query(sql) {
    if (sql.includes("SELECT id")) {
      return {
        rows: [
          {
            id: 1,
            cj_product_id: "missing-test",
            name: "Simulated missing product"
          },
          {
            id: 2,
            cj_product_id: "existing-test",
            name: "Simulated existing product"
          }
        ]
      };
    }

    if (sql.includes("UPDATE cj_products")) {
      missingRecorded = true;

      return {
        rows: [
          { availability_not_found_count: 1 }
        ]
      };
    }

    throw new Error("Unexpected database query");
  },

  async end() {
    assert.equal(missingRecorded, true);
    assert.equal(nextProductSaved, true);
    assert.equal(committed, true);
    assert.equal(process.exitCode || 0, 0);

    console.log("-------------------------");
    console.log("Missing product test PASSED");
    console.log("Next product processed successfully");
    console.log("No real database or CJ API used");
  }
};

const fakeCJApi = {
  async cjRequest(endpoint) {
    if (endpoint.includes("missing-test")) {
      const error = new Error("Product not found");

      error.stage = "request";
      error.kind = "api";
      error.cjCode = 1602001;
      error.httpStatus = 200;

      throw error;
    }

    return {
      pid: "existing-test",
      variants: [
        {
          vid: "test-variant",
          variantSku: "TEST-SKU",
          variantKey: "Blue",
          variantSellPrice: "3.50"
        }
      ]
    };
  }
};

// Replace database and CJ API modules
// with simulated versions for this test only
require.cache[
  require.resolve("./database/db")
] = {
  exports: fakePool,
  loaded: true
};

require.cache[
  require.resolve("./services/cjApi")
] = {
  exports: fakeCJApi,
  loaded: true
};

// Execute the existing synchronisation service
require("./services/syncCJVariants");
