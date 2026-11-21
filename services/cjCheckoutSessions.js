
const crypto = require("crypto");

const pool = require("../database/db");

const {
  validateCJCheckout,
  CheckoutValidationError
} = require("./validateCJCheckout");

// Checkout validity: 15 minutes
const CHECKOUT_TTL_MS = 15 * 60 * 1000;

class CheckoutSessionError extends Error {

  constructor(message, status = 400) {

    super(message);

    this.status = status;
  }
}

// Restrict checkout sessions to development preview
function ensurePreviewMode() {

  if (
    process.env.NODE_ENV === "production" ||
    process.env.YEARBE_CATALOGUE_PREVIEW !== "1"
  ) {

    throw new CheckoutSessionError(
      "CJ checkout preview is unavailable",
      503
    );
  }
}

// Store only a hash of the secret checkout token
function hashToken(token) {

  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

// Convert trusted decimal GBP prices into pence
function toPence(value) {

  if (
    typeof value !== "string" ||
    !/^\d+\.\d{2}$/.test(value)
  ) {

    throw new Error(
      "Invalid validated GBP amount"
    );
  }

  const pence = Number(
    value.replace(".", "")
  );

  if (
    !Number.isSafeInteger(pence) ||
    pence <= 0 ||
    pence > 2147483647
  ) {

    throw new Error(
      "Invalid validated payment amount"
    );
  }

  return pence;
}

// Extract only permitted basket fields.
// Ignore customer-supplied prices and payment flags.
function normaliseCheckoutRequest(body) {

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {

    throw new CheckoutSessionError(
      "Invalid checkout request"
    );
  }

  if (
    !Array.isArray(body.items) ||
    body.items.length < 1 ||
    body.items.length > 5
  ) {

    throw new CheckoutSessionError(
      "Basket must contain between 1 and 5 items"
    );
  }

  const items = body.items.map(item => {

    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item)
    ) {

      throw new CheckoutSessionError(
        "Invalid basket item"
      );
    }

    return {

      variantId: item.variantId,

      quantity: item.quantity,

      shippingMethod:
        typeof item.shippingMethod === "string"
          ? item.shippingMethod.trim()
          : item.shippingMethod
    };
  });

  const postcode =
    body.postcode === undefined
      ? ""
      : body.postcode;

  return {

    items,

    destination: body.destination,

    postcode:
      typeof postcode === "string"
        ? postcode.trim()
        : postcode
  };
}

// Validate the checkout reference and access token
function getCheckoutAccess(body) {

  const {
    checkoutId,
    checkoutToken
  } = body || {};

  if (
    typeof checkoutId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(checkoutId)
  ) {

    throw new CheckoutSessionError(
      "Invalid checkout reference"
    );
  }

  if (
    typeof checkoutToken !== "string" ||
    !/^[0-9a-f]{64}$/.test(checkoutToken)
  ) {

    throw new CheckoutSessionError(
      "Invalid checkout access token"
    );
  }

  return {

    checkoutId: checkoutId.toLowerCase(),

    tokenHash: hashToken(checkoutToken)
  };
}

// Run existing live CJ validation
async function validateSnapshot(request) {

  const startedAt = new Date();

  const result = await validateCJCheckout(
    request
  );

  if (
    result.success !== true ||
    result.validated !== true ||
    result.previewOnly !== true ||
    result.paymentAllowed !== false ||
    result.currency !== "GBP" ||
    result.destination !== request.destination ||
    !Array.isArray(result.items) ||
    result.items.length !== request.items.length
  ) {

    throw new Error(
      "Invalid CJ checkout validation response"
    );
  }

  const amountPence = toPence(
    result.totalGBP
  );

  let calculatedTotal = 0;

  // Confirm validated products match the request
  for (const item of result.items) {

    const requested = request.items.find(
      line => line.variantId === item.variantId
    );

    if (
      !requested ||
      item.quantity !== requested.quantity ||
      item.shippingMethod !== requested.shippingMethod ||
      item.destination !== request.destination
    ) {

      throw new CheckoutSessionError(
        "Product or shipping details have changed",
        409
      );
    }

    calculatedTotal += toPence(
      item.totalGBP
    );
  }

  if (
    !Number.isSafeInteger(calculatedTotal) ||
    calculatedTotal !== amountPence
  ) {

    throw new Error(
      "Validated basket total mismatch"
    );
  }

  const validatedAt = new Date(
    result.validatedAt
  );

  const expiresAt = new Date(
    startedAt.getTime() + CHECKOUT_TTL_MS
  );

  if (
    !Number.isFinite(validatedAt.getTime()) ||
    validatedAt.getTime() < startedAt.getTime() ||
    validatedAt.getTime() >= expiresAt.getTime() ||
    Date.now() >= expiresAt.getTime()
  ) {

    throw new CheckoutSessionError(
      "Checkout validation has expired. Please try again.",
      409
    );
  }

  return {

    validation: result,

    amountPence,

    startedAt,

    validatedAt,

    expiresAt
  };
}

// Return safe checkout information.
// Never expose the stored token hash.
function formatSession(order) {

  const expired =
    order.expired === true ||
    new Date(order.expires_at).getTime()
      <= Date.now();

  const status = expired
    ? "expired"
    : order.status;

  return {

    success: true,

    checkoutId: order.checkout_id,

    status,

    validated:
      status === "preview_validated",

    previewOnly: true,

    paymentAllowed: false,

    currency: order.currency,

    amountPence: order.amount_pence,

    totalGBP:
      (order.amount_pence / 100).toFixed(2),

    destination:
      order.checkout_request.destination,

    postcode:
      order.checkout_request.postcode,

    revision: order.revision,

    conditional:
      order.validation_snapshot.conditional,

    requiresProcurement:
      order.validation_snapshot.requiresProcurement,

    // Last successfully validated supplier quote
    validation:
      order.validation_snapshot,

    validatedAt: order.validated_at,

    expiresAt: order.expires_at,

    createdAt: order.created_at
  };
}

// Create a secure CJ preview checkout
async function createCJCheckoutSession(body) {

  ensurePreviewMode();

  const request =
    normaliseCheckoutRequest(body);

  const snapshot =
    await validateSnapshot(request);

  // Both values are generated by the server
  const checkoutId = crypto.randomUUID();

  const checkoutToken = crypto
    .randomBytes(32)
    .toString("hex");

  const result = await pool.query(`
    INSERT INTO yearbe_cj_checkout_sessions (

      checkout_id,
      access_token_hash,
      checkout_request,
      validation_snapshot,
      amount_pence,
      validation_started_at,
      validated_at,
      expires_at

    )

    VALUES (
      $1,
      $2,
      $3::jsonb,
      $4::jsonb,
      $5,
      $6,
      $7,
      $8
    )

    RETURNING *,
      (expires_at <= NOW()) AS expired
  `, [

    checkoutId,

    hashToken(checkoutToken),

    JSON.stringify(request),

    JSON.stringify(snapshot.validation),

    snapshot.amountPence,

    snapshot.startedAt,

    snapshot.validatedAt,

    snapshot.expiresAt
  ]);

  console.log(
    "CJ preview checkout created:",
    checkoutId
  );

  console.log(
    "Validated amount GBP:",
    (snapshot.amountPence / 100).toFixed(2)
  );

  return {

    ...formatSession(result.rows[0]),

    // Return the secret token only at creation
    checkoutToken
  };
}

// Retrieve an existing secure checkout
async function getCJCheckoutSession(body) {

  ensurePreviewMode();

  const {
    checkoutId,
    tokenHash
  } = getCheckoutAccess(body);

  const result = await pool.query(`
    SELECT *,
      (expires_at <= NOW()) AS expired

    FROM yearbe_cj_checkout_sessions

    WHERE checkout_id = $1
      AND access_token_hash = $2
  `, [

    checkoutId,

    tokenHash
  ]);

  if (result.rows.length !== 1) {

    throw new CheckoutSessionError(
      "Checkout session not found",
      404
    );
  }

  return formatSession(result.rows[0]);
}

// Revalidate using the original server-stored basket.
// Do not accept replacement prices or products.
async function revalidateCJCheckoutSession(body) {

  ensurePreviewMode();

  const {
    checkoutId,
    tokenHash
  } = getCheckoutAccess(body);

  // Invalidate the previous quote before
  // requesting updated supplier information.
  const claimed = await pool.query(`
    UPDATE yearbe_cj_checkout_sessions

    SET
      status = 'revalidation_required',
      revision = revision + 1,
      updated_at = NOW()

    WHERE checkout_id = $1
      AND access_token_hash = $2

    RETURNING *
  `, [

    checkoutId,

    tokenHash
  ]);

  if (claimed.rows.length !== 1) {

    throw new CheckoutSessionError(
      "Checkout session not found",
      404
    );
  }

  const existing = claimed.rows[0];

  // If validation fails, the previous quote
  // remains marked as requiring revalidation.
  const snapshot = await validateSnapshot(
    existing.checkout_request
  );

  const updated = await pool.query(`
    UPDATE yearbe_cj_checkout_sessions

    SET

      validation_snapshot = $3::jsonb,

      amount_pence = $4,

      validation_started_at = $5,

      validated_at = $6,

      expires_at = $7,

      status = 'preview_validated',

      updated_at = NOW()

    WHERE checkout_id = $1
      AND access_token_hash = $2
      AND revision = $8
      AND status = 'revalidation_required'

    RETURNING *,
      (expires_at <= NOW()) AS expired
  `, [

    checkoutId,

    tokenHash,

    JSON.stringify(snapshot.validation),

    snapshot.amountPence,

    snapshot.startedAt,

    snapshot.validatedAt,

    snapshot.expiresAt,

    existing.revision
  ]);

  if (updated.rowCount !== 1) {

    throw new CheckoutSessionError(
      "Checkout was updated by another request",
      409
    );
  }

  console.log(
    "CJ checkout revalidated:",
    checkoutId
  );

  return {

    ...formatSession(updated.rows[0]),

    priceChanged:
      existing.amount_pence !==
        snapshot.amountPence,

    previousTotalGBP:
      (existing.amount_pence / 100).toFixed(2)
  };
}

module.exports = {

  createCJCheckoutSession,

  getCJCheckoutSession,

  revalidateCJCheckoutSession,

  CheckoutSessionError,

  CheckoutValidationError
};
