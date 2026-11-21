
const express = require("express");
const pool = require("../database/db");

const router = express.Router();

const secretKey =
  process.env.STRIPE_SECRET_KEY || "";

const webhookSecret =
  process.env.STRIPE_WEBHOOK_SECRET || "";

// Test mode only during development
const testMode =
  process.env.NODE_ENV !== "production" &&
  secretKey.startsWith("sk_test_");

const stripe = testMode
  ? require("stripe")(secretKey)
  : null;

// Trusted Yearbe product prices in pence
const PRODUCT_PRICES = Object.freeze({
  "White Fitted Single Bedsheet": 299,
  "White Fitted Double Bedsheet": 499
});

class PaymentError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// Prevent live transactions during development
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");

  if (!testMode) {
    return res.status(503).json({
      success: false,
      error: "Bedsheet test payments are unavailable"
    });
  }

  next();
});

function validateCart(cart) {

  if (!Array.isArray(cart) || cart.length === 0) {
    throw new PaymentError("Your basket is empty");
  }

  if (cart.length > 2) {
    throw new PaymentError("Invalid basket");
  }

  const seen = new Set();
  const items = [];

  let amount = 0;

  for (const item of cart) {

    if (
      !item ||
      item.previewOnly ||
      (item.source && item.source !== "yearbe") ||
      !Object.prototype.hasOwnProperty.call(
        PRODUCT_PRICES,
        item.title
      )
    ) {
      throw new PaymentError(
        "Unsupported product in bedsheet checkout"
      );
    }

    if (
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 20
    ) {
      throw new PaymentError(
        "Product quantity must be between 1 and 20"
      );
    }

    if (seen.has(item.title)) {
      throw new PaymentError(
        "Duplicate basket item"
      );
    }

    seen.add(item.title);

    const unitPrice =
      PRODUCT_PRICES[item.title];

    amount += unitPrice * item.quantity;

    items.push({
      title: item.title,
      quantity: item.quantity,
      unitPricePence: unitPrice,
      price: (unitPrice / 100).toFixed(2)
    });
  }

  items.sort((a, b) =>
    a.title.localeCompare(b.title)
  );

  return {
    items,
    amount
  };
}

function validateDelivery(details) {

  if (!details || typeof details !== "object") {
    throw new PaymentError(
      "Delivery details missing"
    );
  }

  function clean(value, maximum = 200) {

    if (typeof value !== "string") {
      return "";
    }

    if (value.length > maximum) {
      throw new PaymentError(
        "Invalid delivery details"
      );
    }

    return value.trim();
  }

  const delivery = {
    title: clean(details.title),
    firstName: clean(details.firstName),
    lastName: clean(details.lastName),
    email: clean(details.email, 254),
    mobile: clean(details.mobile),
    address: clean(details.address, 1000),
    addressLine1: clean(details.addressLine1),
    addressLine2: clean(details.addressLine2),
    addressLine3: clean(details.addressLine3),
    townCity: clean(details.townCity),
    postcode: clean(details.postcode, 20),
    optOut: details.optOut === true
  };

  if (
    !delivery.firstName ||
    !delivery.lastName ||
    !delivery.address ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      delivery.email
    )
  ) {
    throw new PaymentError(
      "Complete all required delivery details"
    );
  }

  return delivery;
}

function validateCheckoutId(checkoutId) {

  if (
    typeof checkoutId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(checkoutId)
  ) {
    throw new PaymentError(
      "Invalid checkout reference"
    );
  }
}

// Verify that the Stripe payment belongs
// to the correct Yearbe order
function verifyIntent(intent, order) {

  if (
    intent.livemode !== false ||
    intent.currency !== "gbp" ||
    intent.amount !== order.amount_pence ||
    intent.metadata?.checkout_id !==
      order.checkout_id ||
    intent.metadata?.source !==
      "yearbe_bedsheets" ||
    (
      order.stripe_payment_intent_id &&
      intent.id !== order.stripe_payment_intent_id
    )
  ) {
    throw new Error(
      "Payment verification mismatch"
    );
  }
}

// Shared payment completion function
// Used by both the webhook and browser verification

async function markOrderPaid(intent, order) {

  verifyIntent(intent, order);

  if (
    !order.stripe_payment_intent_id ||
    intent.status !== "succeeded" ||
    intent.amount_received !== order.amount_pence
  ) {
    throw new Error(
      "Payment completion verification failed"
    );
  }

  const updated = await pool.query(`
    UPDATE yearbe_bedsheet_orders
    SET
      status = 'paid',

      paid_at = COALESCE(paid_at, NOW()),

      confirmation_email_status = CASE
        WHEN status = 'pending'
          AND confirmation_email_status IS NULL
        THEN 'pending'
        ELSE confirmation_email_status
      END

    WHERE checkout_id = $1
      AND stripe_payment_intent_id = $2
      AND amount_pence = $3
      AND status IN ('pending', 'paid')

    RETURNING
      checkout_id,
      status,
      paid_at,
      confirmation_email_status

  `, [
    order.checkout_id,
    intent.id,
    order.amount_pence
  ]);

  if (updated.rowCount !== 1) {
    throw new Error(
      "Unable to mark order as paid"
    );
  }

  return updated.rows[0];
}


function handleError(res, error) {

  if (error instanceof PaymentError) {

    return res.status(error.status).json({
      success: false,
      error: error.message
    });
  }

  console.error(
    "Bedsheet payment error:",
    error.message
  );

  return res.status(500).json({
    success: false,
    error: "Unable to process payment"
  });
}

// Calculate the trusted basket price
router.post("/quote", (req, res) => {

  try {

    const { cart } = req.body || {};

    const result = validateCart(cart);

    res.json({
      success: true,
      amount: result.amount,
      currency: "GBP",
      totalGBP: (result.amount / 100).toFixed(2)
    });

  } catch (error) {

    handleError(res, error);
  }
});

// Create or reuse the Stripe PaymentIntent
router.post("/", async (req, res) => {

  try {

    const {
      checkoutId: suppliedCheckoutId,
      cart,
      deliveryDetails
    } = req.body || {};

    validateCheckoutId(suppliedCheckoutId);

    const checkoutId =
      suppliedCheckoutId.toLowerCase();

    const { items, amount } =
      validateCart(cart);

    const delivery =
      validateDelivery(deliveryDetails);

    // Save the order before requesting payment
    await pool.query(`
      INSERT INTO yearbe_bedsheet_orders (
        checkout_id,
        cart,
        delivery_details,
        amount_pence
      )
      VALUES ($1, $2::jsonb, $3::jsonb, $4)
      ON CONFLICT (checkout_id) DO NOTHING
    `, [
      checkoutId,
      JSON.stringify(items),
      JSON.stringify(delivery),
      amount
    ]);

    const result = await pool.query(`
      SELECT *,
        (
          cart = $2::jsonb
          AND delivery_details = $3::jsonb
          AND amount_pence = $4
        ) AS matching_checkout
      FROM yearbe_bedsheet_orders
      WHERE checkout_id = $1
    `, [
      checkoutId,
      JSON.stringify(items),
      JSON.stringify(delivery),
      amount
    ]);

    const order = result.rows[0];

    if (!order || !order.matching_checkout) {
      throw new PaymentError(
        "Checkout details have changed. Existing payment requires review.",
        409
      );
    }

    let intent;

    // Reuse the original PaymentIntent
    if (order.stripe_payment_intent_id) {

      intent = await stripe.paymentIntents.retrieve(
        order.stripe_payment_intent_id
      );

    } else {

      // Avoid recreating an unresolved old payment
      const age =
        Date.now() -
        new Date(order.created_at).getTime();

      if (
        !Number.isFinite(age) ||
        age < 0 ||
        age >= 23 * 60 * 60 * 1000
      ) {
        throw new PaymentError(
          "Existing checkout requires payment review",
          409
        );
      }

      intent = await stripe.paymentIntents.create(
        {
          amount: order.amount_pence,
          currency: "gbp",

          payment_method_types: ["card"],
          confirmation_method: "automatic",

          description: "Yearbe bedsheet order",

          metadata: {
            checkout_id: checkoutId,
            source: "yearbe_bedsheets"
          }
        },
        {
          idempotencyKey:
            `yearbe-bedsheets-${checkoutId}`
        }
      );

      verifyIntent(intent, order);

      const saved = await pool.query(`
        UPDATE yearbe_bedsheet_orders
        SET stripe_payment_intent_id = $2
        WHERE checkout_id = $1
          AND (
            stripe_payment_intent_id IS NULL
            OR stripe_payment_intent_id = $2
          )
      `, [
        checkoutId,
        intent.id
      ]);

      if (saved.rowCount !== 1) {
        throw new Error(
          "Unable to associate payment with order"
        );
      }
    }

    verifyIntent(intent, order);

    res.json({
      success: true,
      clientSecret: intent.client_secret,
      status: intent.status,
      amount: order.amount_pence,
      currency: "GBP"
    });

  } catch (error) {

    handleError(res, error);
  }
});

// Independently verify successful payment
router.post("/verify", async (req, res) => {

  try {

    const { checkoutId } = req.body || {};

    validateCheckoutId(checkoutId);

    const result = await pool.query(`
      SELECT *
      FROM yearbe_bedsheet_orders
      WHERE checkout_id = $1
    `, [checkoutId]);

    const order = result.rows[0];

    if (!order || !order.stripe_payment_intent_id) {

      throw new PaymentError(
        "Payment reference not found",
        404
      );
    }

    const intent = await stripe.paymentIntents.retrieve(
      order.stripe_payment_intent_id
    );

    verifyIntent(intent, order);

    if (
      intent.status !== "succeeded" ||
      intent.amount_received !== order.amount_pence
    ) {
      throw new PaymentError(
        "Payment has not been confirmed",
        409
      );
    }

    // Use shared payment completion function
    await markOrderPaid(intent, order);

    res.json({
      success: true,
      paid: true,
      amount: order.amount_pence,
      currency: "GBP"
    });

  } catch (error) {

    handleError(res, error);
  }
});

// Stripe webhook
// Must receive the original raw request body
async function handleWebhook(req, res) {

  res.set("Cache-Control", "no-store");

  if (
    !testMode ||
    !stripe ||
    !webhookSecret.startsWith("whsec_")
  ) {
    return res.status(503).json({
      error: "Stripe test webhook is unavailable"
    });
  }

  const signature =
    req.headers["stripe-signature"];

  if (
    typeof signature !== "string" ||
    !Buffer.isBuffer(req.body)
  ) {
    return res.status(400).json({
      error: "Invalid webhook request"
    });
  }

  let event;

  // Authenticate the event using Stripe's signature
  try {

    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      webhookSecret
    );

  } catch (error) {

    console.error(
      "Webhook signature verification failed:",
      error.message
    );

    return res.status(400).json({
      error: "Invalid webhook signature"
    });
  }

  try {

    // Never process live-mode events
    if (event.livemode !== false) {
      return res.status(400).json({
        error: "Live webhook events are disabled"
      });
    }

    // Only process successful PaymentIntents
    if (event.type !== "payment_intent.succeeded") {

      return res.json({
        received: true,
        ignored: true
      });
    }

    const intent = event.data.object;

    // Ignore unrelated Stripe payments
    if (
      intent.metadata?.source !==
      "yearbe_bedsheets"
    ) {
      return res.json({
        received: true,
        ignored: true
      });
    }

    const checkoutId =
      intent.metadata?.checkout_id;

    validateCheckoutId(checkoutId);

    const result = await pool.query(`
      SELECT *
      FROM yearbe_bedsheet_orders
      WHERE checkout_id = $1
    `, [checkoutId]);

    const order = result.rows[0];

    if (!order) {
      throw new Error(
        "Webhook order reference not found"
      );
    }

    // Update PostgreSQL independently
    // of the customer's browser
    await markOrderPaid(intent, order);

    console.log("-------------------------");

    console.log(
      "Stripe webhook: payment confirmed"
    );

    console.log(
      "Checkout ID:",
      checkoutId
    );

    console.log(
      "PaymentIntent:",
      intent.id
    );

    console.log(
      "Amount GBP:",
      (intent.amount_received / 100).toFixed(2)
    );

    console.log(
      "Order status: paid"
    );

    console.log("-------------------------");

    // Acknowledge only after database update succeeds
    return res.json({
      received: true
    });

  } catch (error) {

    console.error(
      "Stripe webhook processing failed:",
      error.message
    );

    // Allow Stripe to retry failed delivery
    return res.status(500).json({
      error: "Webhook processing failed"
    });
  }
}

module.exports = router;
module.exports.handleWebhook = handleWebhook;
