
require("dotenv").config();

const { randomUUID } = require("crypto");

async function test() {

  const key = process.env.STRIPE_SECRET_KEY || "";

  // Allow test payments only
  if (
    process.env.NODE_ENV === "production" ||
    !key.startsWith("sk_test_")
  ) {
    throw new Error("Stripe test mode required");
  }

  const stripe = require("stripe")(key);

  const checkoutId = randomUUID();

  console.log("Starting independent webhook test...");
  console.log("Checkout ID:", checkoutId);

  // Create a Yearbe bedsheet test order
  const response = await fetch(
    "http://localhost:3001/payment",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        checkoutId,

        cart: [
          {
            title: "White Fitted Single Bedsheet",
            quantity: 2
          }
        ],

        deliveryDetails: {
          firstName: "Webhook",
          lastName: "Test",
          email: "test@example.com",
          address: "1 Test Street, London",
          postcode: "SW1A 1AA"
        }
      })
    }
  );

  const data = await response.json();

  if (
    !response.ok ||
    !data.success ||
    data.amount !== 598 ||
    !data.clientSecret
  ) {
    throw new Error(
      data.error || "Checkout creation failed"
    );
  }

  const intentId =
    data.clientSecret.split("_secret_")[0];

  console.log("PaymentIntent:", intentId);

  // Retrieve and validate the original PaymentIntent
  const original =
    await stripe.paymentIntents.retrieve(intentId);

  if (
    original.livemode !== false ||
    original.amount !== 598 ||
    original.currency !== "gbp" ||
    original.metadata.checkout_id !== checkoutId ||
    original.metadata.source !== "yearbe_bedsheets"
  ) {
    throw new Error("Payment verification failed");
  }

  // Confirm using Stripe's test payment method
  const intent = await stripe.paymentIntents.confirm(
    intentId,
    {
      payment_method: "pm_card_visa"
    }
  );

  console.log("--------------------------------");
  console.log("Checkout ID:", checkoutId);
  console.log("PaymentIntent:", intent.id);
  console.log("Stripe status:", intent.status);
  console.log("Amount GBP:", (intent.amount / 100).toFixed(2));
  console.log("Browser verification was not called");
  console.log("--------------------------------");

  if (intent.status !== "succeeded") {
    throw new Error("Test payment did not succeed");
  }

  console.log("Stripe test payment successful.");
  console.log("Check Stripe CLI and PostgreSQL.");
}

test().catch(error => {

  console.error("Test failed:", error.message);

  process.exitCode = 1;

});
