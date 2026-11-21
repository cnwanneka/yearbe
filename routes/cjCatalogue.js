
const express = require("express");
const pool = require("../database/db");

const router = express.Router();
const { getProductQuote } = require("../services/cjPricing");
const {
  validateCJCheckout,
  CheckoutValidationError
} = require("../services/validateCJCheckout");

const {
  createCJCheckoutSession,
  getCJCheckoutSession,
  revalidateCJCheckoutSession,
  CheckoutSessionError
} = require("../services/cjCheckoutSessions");

const {
  convertGBP,
  SUPPORTED_CURRENCIES
} = require("../services/currencyService");

// Restrict this development preview to local connections
router.use((req, res, next) => {
  const localAddresses = [
    "127.0.0.1",
    "::1",
    "::ffff:127.0.0.1"
  ];

  if (!localAddresses.includes(req.socket.remoteAddress)) {
    return res.status(403).json({
      error: "Local preview only"
    });
  }

  next();
});


router.get("/categories", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COALESCE(c.group_name, 'Uncategorised') AS name,
        COUNT(*)::integer AS product_count
      FROM cj_products p
      LEFT JOIN cj_categories c
        ON c.category_id = p.category_id
      WHERE p.status = 'draft'
      GROUP BY 1
      ORDER BY 1
    `);

    res.json({
      success: true,
      categories: result.rows
    });

  } catch (error) {
    console.error("Category error:", error.message);

    res.status(500).json({
      error: "Unable to retrieve categories"
    });
  }
});

router.get("/products", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);

    const search = String(req.query.search || "")
      .trim();

    const category = String(req.query.category || "")
      .trim();

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > 1000000 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      search.length > 100 ||
      category.length > 200
    ) {
      return res.status(400).json({
        error: "Invalid search parameters"
      });
    }

    const offset = (page - 1) * limit;

    const filters = `
      FROM cj_products p
      LEFT JOIN cj_categories c
        ON c.category_id = p.category_id
      WHERE p.status = 'draft'
        AND (
          $1 = '' OR
          STRPOS(
            LOWER(
              CONCAT_WS(
                ' ',
                p.name,
                c.category_name,
                c.group_name
              )
            ),
            LOWER($1)
          ) > 0
        )
        AND (
          $2 = '' OR
          COALESCE(c.group_name, 'Uncategorised') = $2
        )
    `;

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total ${filters}`,
      [search, category]
    );

    const total = Number(countResult.rows[0].total);

    const result = await pool.query(`
      SELECT
        p.id,
        p.name,
        p.image_url,
        p.category_id,
        p.status,
        COALESCE(
          c.category_name,
          'Uncategorised'
        ) AS category_name,
        (
          SELECT COUNT(*)::integer
          FROM cj_variants v
          WHERE v.product_id = p.id
        ) AS variant_count
      ${filters}
      ORDER BY p.id
      LIMIT $3 OFFSET $4
    `, [search, category, limit, offset]);

    res.json({
      success: true,
      previewOnly: true,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      products: result.rows
    });

  } catch (error) {
    console.error("Catalogue error:", error.message);

    res.status(500).json({
      error: "Unable to retrieve catalogue"
    });
  }
});



router.get("/products/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1 ||
        id > 2147483647) {
      return res.status(400).json({
        error: "Invalid product ID"
      });
    }

    const productResult = await pool.query(`
      SELECT id, name, image_url, category_id
      FROM cj_products
      WHERE id = $1 AND status = 'draft'
    `, [id]);

    if (productResult.rows.length === 0) {
      return res.status(404).json({
        error: "Product not found"
      });
    }

    const variantResult = await pool.query(`
      SELECT
        id,
        sku,
        variant_key,
        variant_image_url
      FROM cj_variants
      WHERE product_id = $1
      ORDER BY id
    `, [id]);

    res.json({
      success: true,
      previewOnly: true,
      product: productResult.rows[0],
      variants: variantResult.rows
    });

  } catch (error) {
    console.error("Product details error:", error.message);

    res.status(500).json({
      error: "Unable to retrieve product details"
    });
  }
});


let quoteInProgress = false;
let nextQuoteAt = 0;

router.post("/quote", async (req, res) => {
  const {
    variantId,
    quantity = 1,
    destination = "GB",
    currency = "GBP"
  } = req.body || {};

  if (
    !Number.isInteger(variantId) ||
    variantId < 1 ||
    variantId > 2147483647 ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 20 ||
    typeof destination !== "string" ||
    !/^[A-Z]{2}$/.test(destination) ||
    !SUPPORTED_CURRENCIES.includes(currency)
  ) {
    return res.status(400).json({
      error: "Invalid quotation request"
    });
  }

  if (quoteInProgress || Date.now() < nextQuoteAt) {
    return res.status(429).json({
      error: "Please wait a few seconds and try again"
    });
  }

  quoteInProgress = true;

  try {
    const result = await pool.query(`
      SELECT v.sku
      FROM cj_variants v
      JOIN cj_products p ON p.id = v.product_id
      WHERE v.id = $1
        AND p.status = 'draft'
    `, [variantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Product variant not found"
      });
    }

    const quote = await getProductQuote({
      sku: result.rows[0].sku,
      variantId,
      destination,
      quantity
    });

    const converted = await convertGBP(
      quote.sellingPriceGBP,
      currency
    );

    res.set("Cache-Control", "no-store");

    res.json({
      success: true,
      previewOnly: true,
      quantity,
      destination,
      currency,
      priceGBP: quote.sellingPriceGBP,
      displayPrice: converted.formattedPrice,
      shippingMethod: quote.shippingMethod,
      transitTime: quote.transitTime
    });

  } catch (error) {
    console.error("Quote error:", error.message);

    const safeErrors = [
      "Inventory needs refreshing",
      "GBP costs need refreshing",
      "Insufficient reported stock",
      "No shipping options available"
    ];

    res.status(422).json({
      error: safeErrors.includes(error.message)
        ? error.message
        : "Unable to calculate delivery price"
    });

  } finally {
    quoteInProgress = false;
    nextQuoteAt = Date.now() + 1500;
  }
});


// Secure CJ checkout validation — preview only
router.post("/validate-checkout", async (req, res) => {

  res.set("Cache-Control", "no-store");

  // Share the existing quotation request limiter
  if (quoteInProgress || Date.now() < nextQuoteAt) {
    return res.status(429).json({
      success: false,
      error: "Please wait a few seconds and try again"
    });
  }

  quoteInProgress = true;

  try {

    const result = await validateCJCheckout(
      req.body || {}
    );

    return res.json(result);

  } catch (error) {

    console.error(
      "Checkout validation error:",
      error.message
    );

    if (error instanceof CheckoutValidationError) {
      return res.status(error.status).json({
        success: false,
        validated: false,
        previewOnly: true,
        paymentAllowed: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      validated: false,
      previewOnly: true,
      paymentAllowed: false,
      error: "Unable to validate basket. Please try again."
    });

  } finally {

    quoteInProgress = false;
    nextQuoteAt = Date.now() + 1500;

  }
});

// Shared handler for secure preview checkout sessions
async function handleCJSessionRequest(
  req,
  res,
  operation,
  requiresLiveValidation = false,
  successStatus = 200
) {

  res.set("Cache-Control", "no-store");

  // Reuse the existing CJ quotation limiter
  if (requiresLiveValidation) {

    if (
      quoteInProgress ||
      Date.now() < nextQuoteAt
    ) {

      return res.status(429).json({

        success: false,

        previewOnly: true,

        paymentAllowed: false,

        error:
          "Please wait a few seconds and try again"
      });
    }

    quoteInProgress = true;
  }

  try {

    const result = await operation(
      req.body || {}
    );

    return res.status(
      successStatus
    ).json(result);

  } catch (error) {

    console.error(
      "CJ checkout session error:",
      error.message
    );

    if (
      error instanceof CheckoutSessionError ||
      error instanceof CheckoutValidationError
    ) {

      return res.status(error.status).json({

        success: false,

        validated: false,

        previewOnly: true,

        paymentAllowed: false,

        error: error.message
      });
    }

    return res.status(500).json({

      success: false,

      validated: false,

      previewOnly: true,

      paymentAllowed: false,

      error:
        "Unable to process checkout session"
    });

  } finally {

    if (requiresLiveValidation) {

      quoteInProgress = false;

      nextQuoteAt = Date.now() + 1500;
    }
  }
}

// Create a secure CJ checkout session
router.post("/checkout/create", (req, res) => {

  return handleCJSessionRequest(

    req,

    res,

    createCJCheckoutSession,

    true,

    201
  );
});

// Retrieve a secure CJ checkout session
router.post("/checkout/status", (req, res) => {

  return handleCJSessionRequest(

    req,

    res,

    getCJCheckoutSession
  );
});

// Revalidate an existing CJ checkout session
router.post("/checkout/revalidate", (req, res) => {

  return handleCJSessionRequest(

    req,

    res,

    revalidateCJCheckoutSession,

    true
  );
});

module.exports = router;


