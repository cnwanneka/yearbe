
require("dotenv").config();

const nodemailer = require("nodemailer");
const pool = require("./database/db");

async function startTest() {

  // Development test mode only
  if (
    process.env.NODE_ENV === "production" ||
    process.env.YEARBE_EMAIL_TEST_MODE !== "1" ||
    !(process.env.STRIPE_SECRET_KEY || "")
      .startsWith("sk_test_")
  ) {
    throw new Error(
      "Yearbe development test mode required"
    );
  }

  const checkoutId =
    (process.argv[2] || "").toLowerCase();

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      .test(checkoutId)
  ) {
    throw new Error(
      "Provide a valid test checkout ID"
    );
  }

  // Validate only the selected test order
  const result = await pool.query(`
    SELECT checkout_id
    FROM yearbe_bedsheet_orders

    WHERE checkout_id = $1
      AND status = 'paid'
      AND confirmation_email_status = 'pending'
      AND confirmation_email_sent_at IS NULL
      AND confirmation_email_message_id IS NULL
  `, [checkoutId]);

  if (result.rows.length !== 1) {

    throw new Error(
      "Selected test order is not eligible"
    );
  }

  // Restrict this worker to the selected order
  process.env.YEARBE_EMAIL_TEST_CHECKOUT_ID =
    checkoutId;

  const expectedMessageId =
    `<yearbe-bedsheets-${checkoutId}@yearbe.com>`;

  const originalCreateTransport =
    nodemailer.createTransport;

  nodemailer.createTransport = function (...args) {

    const transport =
      originalCreateTransport.apply(this, args);

    transport.sendMail = async function (message) {

      // Prevent all actual email transmission
      // during this simulation
      if (
        message.messageId !== expectedMessageId
      ) {

        const error = new Error(
          "Unexpected order blocked"
        );

        error.code = "TEST_ORDER_MISMATCH";

        throw error;
      }

      console.log(
        "SIMULATED SMTP TRANSMISSION FAILURE"
      );

      console.log(
        "Order reference:",
        checkoutId
      );

      console.log(
        "No email was transmitted"
      );

      const error = new Error(
        "Simulated SMTP connection failure"
      );

      error.code = "ECONNECTION";

      throw error;
    };

    return transport;
  };

  console.log(
    "Yearbe SMTP failure simulation enabled"
  );

  console.log(
    "Selected test order:",
    checkoutId
  );

  console.log(
    "All other orders excluded"
  );

  require("./services/sendBedsheetEmails.js");
}

startTest().catch(async error => {

  console.error(
    "SMTP failure test could not start:",
    error.message
  );

  await pool.end();

  process.exitCode = 1;
});
