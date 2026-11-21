
require("dotenv").config();

const nodemailer = require("nodemailer");
const pool = require("../database/db");

const gmailUser = process.env.GMAIL_USER || "";
const gmailPass = process.env.GMAIL_PASS || "";
const testEmail = process.env.YEARBE_TEST_EMAIL || "";

const emailPattern =
  /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

// Development email safety restrictions
function validateConfiguration() {

  if (
    process.env.NODE_ENV === "production" ||
    process.env.YEARBE_EMAIL_TEST_MODE !== "1" ||
    !(process.env.STRIPE_SECRET_KEY || "")
      .startsWith("sk_test_")
  ) {
    throw new Error(
      "Yearbe test email mode required"
    );
  }

  if (
    !emailPattern.test(gmailUser) ||
    !gmailPass ||
    !emailPattern.test(testEmail)
  ) {
    throw new Error(
      "Email configuration is incomplete"
    );
  }
}

const transporter = nodemailer.createTransport({
  service: "gmail",

  auth: {
    user: gmailUser,
    pass: gmailPass
  },

  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 30000
});

// Format prices in British pounds
function formatGBP(pence) {

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP"
  }).format(Number(pence) / 100);
}

// Prevent customer-provided information
// from injecting HTML into emails
function escapeHtml(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Reserve one email for processing
// Prevent concurrent workers sending
// the same confirmation email

// Optional restriction for email failure testing
const testCheckoutId =
  process.env.YEARBE_EMAIL_TEST_CHECKOUT_ID || null;

// Reserve one email for processing
async function claimNextOrder() {

  const result = await pool.query(`
    WITH next_order AS (
      SELECT checkout_id
      FROM yearbe_bedsheet_orders
      WHERE status = 'paid'
        AND confirmation_email_status = 'pending'
        AND (
          $1::text IS NULL
          OR checkout_id::text = $1::text
        )
      ORDER BY paid_at, checkout_id
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )

    UPDATE yearbe_bedsheet_orders AS orders

    SET
      confirmation_email_status = 'sending',
      confirmation_email_attempted_at = NOW(),
      confirmation_email_error = NULL

    FROM next_order

    WHERE orders.checkout_id =
      next_order.checkout_id

    RETURNING orders.*
  `, [testCheckoutId]);

  return result.rows[0] || null;
}


// Build professional Yearbe confirmation email
function buildEmail(order) {

  const delivery = order.delivery_details;
  const cart = order.cart;

  if (
    !delivery ||
    !Array.isArray(cart) ||
    cart.length === 0
  ) {
    throw new Error("Invalid order details");
  }

  const customerName =
    `${delivery.firstName} ${delivery.lastName}`;

  const orderDate = new Date(
    order.paid_at
  ).toLocaleDateString("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  const totalPaid =
    formatGBP(order.amount_pence);

  const year = new Date(
    order.paid_at
  ).getUTCFullYear();

  // Safe HTML values
  const safeName = escapeHtml(customerName);

  const safeAddress =
    escapeHtml(delivery.address)
      .replace(/\r\n|\r|\n/g, "<br>");

  const safeOrderId =
    escapeHtml(order.checkout_id);

  const safeOrderDate =
    escapeHtml(orderDate);

  const safeTotal =
    escapeHtml(totalPaid);

  // Plain-text product summary
  const productsText = cart.map(item => {

    const itemTotal =
      item.unitPricePence * item.quantity;

    return (
      `${item.title}\n` +
      `Quantity: ${item.quantity}\n` +
      `Unit price: ${formatGBP(item.unitPricePence)}\n` +
      `Subtotal: ${formatGBP(itemTotal)}`
    );

  }).join("\n\n");

  // HTML product summary
  const productsHtml = cart.map(item => {

    const itemTotal =
      item.unitPricePence * item.quantity;

    return `
      <tr>
        <td style="
          padding:16px 0;
          border-bottom:1px solid #e5e7eb;
          vertical-align:top;
        ">
          <strong style="
            font-size:15px;
            color:#162b45;
          ">
            ${escapeHtml(item.title)}
          </strong>

          <div style="
            font-size:13px;
            color:#64748b;
            margin-top:6px;
            line-height:1.6;
          ">
            Quantity: ${escapeHtml(item.quantity)}
            <br>
            Unit price:
            ${escapeHtml(formatGBP(item.unitPricePence))}
          </div>
        </td>

        <td align="right" style="
          padding:16px 0 16px 12px;
          border-bottom:1px solid #e5e7eb;
          vertical-align:top;
          white-space:nowrap;
          font-weight:bold;
          color:#162b45;
        ">
          ${escapeHtml(formatGBP(itemTotal))}
        </td>
      </tr>
    `;

  }).join("");

  // Plain-text fallback
  const text = `
YEARBE LTD
Order Confirmation

DEVELOPMENT TEST EMAIL — NO REAL PAYMENT

Dear ${customerName},

Thank you for shopping with Yearbe.

We are pleased to confirm that your order
has been received and payment was successful.

ORDER DETAILS

Order reference:
${order.checkout_id}

Order date:
${orderDate}

YOUR ITEMS

${productsText}

TOTAL PAID

${totalPaid}

Payment status: Paid

DELIVERY ADDRESS

${customerName}
${delivery.address}

Estimated delivery: Within 7 days,
subject to dispatch.

Thank you for choosing Yearbe.

Kind regards,
The Yearbe Team

https://yearbe.com
`;

  // Professional HTML email
  const html = `
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport"
        content="width=device-width, initial-scale=1.0">
  <title>Yearbe Order Confirmation</title>
</head>

<body style="
  margin:0;
  padding:0;
  background-color:#f1f5f9;
  font-family:Arial, Helvetica, sans-serif;
  color:#334155;
  -webkit-text-size-adjust:100%;
">

<table role="presentation"
       width="100%"
       cellspacing="0"
       cellpadding="0"
       border="0"
       style="background-color:#f1f5f9;">

  <tr>
    <td align="center" style="padding:20px 10px;">

      <table role="presentation"
             width="100%"
             cellspacing="0"
             cellpadding="0"
             border="0"
             style="
               max-width:600px;
               background-color:#ffffff;
               border:1px solid #e2e8f0;
               border-radius:12px;
             ">

        <!-- YEARBE HEADER -->

        <tr>
          <td align="center" style="
            background-color:#162b45;
            padding:35px 20px;
            border-radius:12px 12px 0 0;
          ">

            <div style="
              font-size:34px;
              font-weight:bold;
              letter-spacing:5px;
              color:#ffffff;
            ">
              YEARBE
            </div>

            <div style="
              margin-top:10px;
              font-size:11px;
              letter-spacing:2px;
              color:#dbeafe;
            ">
              COMFORT &middot; QUALITY &middot; VALUE
            </div>

          </td>
        </tr>

        <!-- DEVELOPMENT TEST NOTICE -->

        <tr>
          <td align="center" style="
            padding:12px;
            background-color:#fff7ed;
            color:#9a3412;
            font-size:11px;
            font-weight:bold;
          ">
            DEVELOPMENT TEST EMAIL — NO REAL PAYMENT
          </td>
        </tr>

        <!-- PAYMENT SUCCESS -->

        <tr>
          <td align="center" style="
            padding:35px 25px 15px;
          ">

            <table role="presentation"
                   cellspacing="0"
                   cellpadding="0"
                   border="0">
              <tr>
                <td align="center" style="
                  width:60px;
                  height:60px;
                  background-color:#dcfce7;
                  border-radius:50%;
                  color:#15803d;
                  font-size:34px;
                  font-weight:bold;
                ">
                  &#10003;
                </td>
              </tr>
            </table>

            <h1 style="
              font-size:26px;
              color:#162b45;
              margin:20px 0 10px;
              line-height:1.3;
            ">
              Thank you for your order!
            </h1>

            <p style="
              margin:0;
              font-size:15px;
              color:#64748b;
              line-height:1.6;
            ">
              Your payment has been successfully confirmed.
            </p>

          </td>
        </tr>

        <!-- CUSTOMER MESSAGE -->

        <tr>
          <td style="
            padding:20px 25px;
            font-size:15px;
            line-height:1.7;
          ">

            <p style="margin:0 0 12px;">
              Dear ${safeName},
            </p>

            <p style="margin:0;">
              Thank you for shopping with Yearbe.
              We are pleased to confirm that your
              order has been received.
            </p>

          </td>
        </tr>

        <!-- ORDER REFERENCE -->

        <tr>
          <td style="padding:0 25px 25px;">

            <table role="presentation"
                   width="100%"
                   cellspacing="0"
                   cellpadding="0"
                   border="0"
                   style="
                     background-color:#f8fafc;
                     border:1px solid #e2e8f0;
                     border-radius:8px;
                   ">

              <tr>
                <td style="padding:18px;">

                  <div style="
                    font-size:11px;
                    font-weight:bold;
                    letter-spacing:1px;
                    color:#64748b;
                  ">
                    ORDER REFERENCE
                  </div>

                  <div style="
                    margin-top:8px;
                    font-size:13px;
                    font-weight:bold;
                    color:#162b45;
                    word-break:break-all;
                  ">
                    ${safeOrderId}
                  </div>

                  <div style="
                    margin-top:12px;
                    font-size:13px;
                    color:#64748b;
                  ">
                    Order date: ${safeOrderDate}
                  </div>

                </td>
              </tr>

            </table>

          </td>
        </tr>

        <!-- ORDER SUMMARY -->

        <tr>
          <td style="padding:0 25px;">

            <h2 style="
              color:#162b45;
              font-size:19px;
              margin:0 0 15px;
            ">
              Order summary
            </h2>

            <table width="100%"
                   cellspacing="0"
                   cellpadding="0"
                   border="0"
                   style="font-size:14px;">

              <tr>
                <th align="left" scope="col" style="
                  padding:10px 0;
                  border-bottom:2px solid #e2e8f0;
                  color:#64748b;
                  font-size:12px;
                ">
                  PRODUCT
                </th>

                <th align="right" scope="col" style="
                  padding:10px 0;
                  border-bottom:2px solid #e2e8f0;
                  color:#64748b;
                  font-size:12px;
                ">
                  SUBTOTAL
                </th>
              </tr>

              ${productsHtml}

              <tr>
                <td style="
                  padding:22px 0 8px;
                  font-weight:bold;
                  font-size:17px;
                  color:#162b45;
                ">
                  Total paid
                </td>

                <td align="right" style="
                  padding:22px 0 8px;
                  color:#162b45;
                  font-size:25px;
                  font-weight:bold;
                ">
                  ${safeTotal}
                </td>
              </tr>

              <tr>
                <td colspan="2"
                    align="right"
                    style="padding-bottom:25px;">

                  <span style="
                    background-color:#dcfce7;
                    color:#166534;
                    border-radius:20px;
                    padding:6px 12px;
                    font-size:12px;
                    font-weight:bold;
                  ">
                    PAYMENT SUCCESSFUL
                  </span>

                </td>
              </tr>

            </table>

          </td>
        </tr>

        <!-- DELIVERY INFORMATION -->

        <tr>
          <td style="padding:0 25px 25px;">

            <table role="presentation"
                   width="100%"
                   cellspacing="0"
                   cellpadding="0"
                   border="0"
                   style="
                     background-color:#f8fafc;
                     border:1px solid #e2e8f0;
                     border-radius:8px;
                   ">

              <tr>
                <td style="padding:20px;">

                  <h2 style="
                    font-size:17px;
                    color:#162b45;
                    margin:0 0 15px;
                  ">
                    Delivery information
                  </h2>

                  <div style="
                    font-size:14px;
                    line-height:1.7;
                    color:#334155;
                  ">
                    <strong>${safeName}</strong>
                    <br>
                    ${safeAddress}
                  </div>

                  <p style="
                    font-size:13px;
                    line-height:1.6;
                    color:#64748b;
                    margin:15px 0 0;
                  ">
                    <strong>Estimated delivery:</strong>
                    Within 7 days, subject to dispatch.
                  </p>

                </td>
              </tr>

            </table>

          </td>
        </tr>

        <!-- CONTINUE SHOPPING BUTTON -->

        <tr>
          <td align="center" style="
            padding:5px 25px 30px;
          ">

            <table role="presentation"
                   cellspacing="0"
                   cellpadding="0"
                   border="0">

              <tr>
                <td align="center" style="
                  background-color:#162b45;
                  border-radius:6px;
                ">

                  <a href="https://yearbe.com"
                     style="
                       display:inline-block;
                       padding:16px 36px;
                       color:#ffffff;
                       font-size:15px;
                       font-weight:bold;
                       text-decoration:none;
                     ">
                    Continue shopping
                  </a>

                </td>
              </tr>

            </table>

          </td>
        </tr>

        <!-- CUSTOMER SIGN OFF -->

        <tr>
          <td align="center" style="
            padding:0 25px 30px;
            font-size:14px;
            line-height:1.7;
          ">

            Thank you for choosing Yearbe.
            <br>
            We look forward to serving you again.

            <p style="margin:18px 0 0;">
              Kind regards,
              <br>
              <strong style="color:#162b45;">
                The Yearbe Team
              </strong>
            </p>

          </td>
        </tr>

        <!-- FOOTER -->

        <tr>
          <td align="center" style="
            background-color:#f8fafc;
            border-top:1px solid #e2e8f0;
            padding:25px 20px;
            border-radius:0 0 12px 12px;
            font-size:12px;
            color:#64748b;
            line-height:1.8;
          ">

            <strong style="color:#162b45;">
              YEARBE LTD
            </strong>

            <br>

            <a href="https://yearbe.com"
               style="
                 color:#162b45;
                 text-decoration:none;
               ">
              www.yearbe.com
            </a>

            <br>

            &copy; ${year} Yearbe Ltd.
            All rights reserved.

          </td>
        </tr>

      </table>

    </td>
  </tr>

</table>

</body>
</html>
`;

  return {

    from: {
      name: "Yearbe Ltd",
      address: gmailUser
    },

    // Never send to actual customer addresses
    // while development test mode is enabled
    to: {
      name: "Yearbe Test",
      address: testEmail
    },

    subject:
      "TEST — Yearbe Order Confirmation",

    messageId:
      `<yearbe-bedsheets-${order.checkout_id}@yearbe.com>`,

    text: text.trim(),

    html: html.trim()
  };
}


// Email recovery configuration
const SMTP_RETRY_INTERVAL = 60000;

const WORKER_INTERVAL = 10000;

let smtpReady = false;

let nextSmtpCheckAt = 0;

let processing = false;

// Identify interrupted email transmissions

async function recoverInterruptedEmails() {

  const result = await pool.query(`
    UPDATE yearbe_bedsheet_orders

    SET
      confirmation_email_status = 'review_required',
      confirmation_email_error = 'INTERRUPTED_DELIVERY'

    WHERE status = 'paid'

      AND confirmation_email_status = 'sending'

      AND (
        $1::text IS NULL
        OR checkout_id::text = $1::text
      )

      AND (
        confirmation_email_attempted_at IS NULL
        OR confirmation_email_attempted_at
          <= NOW() - INTERVAL '15 minutes'
      )

    RETURNING checkout_id
  `, [testCheckoutId]);

  for (const order of result.rows) {

    console.warn(
      "Interrupted email requires review:",
      order.checkout_id
    );
  }
}


// Check Gmail availability without
// continuously attempting authentication
async function ensureSmtpReady() {

  if (smtpReady) {
    return true;
  }

  if (Date.now() < nextSmtpCheckAt) {
    return false;
  }

  try {

    console.log(
      "Checking Gmail SMTP connection..."
    );

    await transporter.verify();

    smtpReady = true;

    nextSmtpCheckAt = 0;

    console.log(
      "Gmail SMTP connection successful"
    );

    return true;

  } catch (error) {

    smtpReady = false;

    nextSmtpCheckAt =
      Date.now() + SMTP_RETRY_INTERVAL;

    console.error(
      "Gmail temporarily unavailable:",
      error.code || "SMTP_ERROR"
    );

    console.log(
      "Pending emails are preserved."
    );

    console.log(
      "Retrying SMTP connection in 60 seconds."
    );

    return false;
  }
}

// Process one pending confirmation email
async function processNextEmail() {

  const order = await claimNextOrder();

  if (!order) {
    return;
  }

  let smtpAttempted = false;

  let smtpAccepted = false;

  console.log(
    "Processing confirmation:",
    order.checkout_id
  );

  try {

    const message = buildEmail(order);

    smtpAttempted = true;

    const info = await transporter.sendMail(
      message
    );

    if (
      !Array.isArray(info.accepted) ||
      info.accepted.length !== 1
    ) {
      throw new Error(
        "Email acceptance not confirmed"
      );
    }

    smtpAccepted = true;

    const updated = await pool.query(`
      UPDATE yearbe_bedsheet_orders

      SET
        confirmation_email_status = 'sent',

        confirmation_email_sent_at = NOW(),

        confirmation_email_message_id = $2,

        confirmation_email_error = NULL

      WHERE checkout_id = $1

        AND confirmation_email_status = 'sending'
    `, [
      order.checkout_id,
      info.messageId
    ]);

    if (updated.rowCount !== 1) {

      throw new Error(
        "Unable to record email acceptance"
      );
    }

    console.log(
      "Yearbe HTML confirmation email sent"
    );

    console.log(
      "Order reference:",
      order.checkout_id
    );

  } catch (error) {

    const originalCode =
      String(error.code || "EMAIL_ERROR")
        .slice(0, 40);

    let errorCode;

    if (smtpAccepted) {

      // Gmail accepted the message but
      // recording the result failed
      errorCode = "SMTP_ACCEPTED_DB_ERROR";

    } else if (smtpAttempted) {

      // Delivery may have occurred.
      // Never automatically resend.
      errorCode =
        `DELIVERY_UNCERTAIN_${originalCode}`;

      smtpReady = false;

      nextSmtpCheckAt =
        Date.now() + SMTP_RETRY_INTERVAL;

    } else {

      // Failure occurred before SMTP transmission
      errorCode =
        `PRE_SEND_${originalCode}`;
    }

    await pool.query(`
      UPDATE yearbe_bedsheet_orders

      SET
        confirmation_email_status =
          'review_required',

        confirmation_email_error = $2

      WHERE checkout_id = $1

        AND confirmation_email_status = 'sending'
    `, [
      order.checkout_id,
      errorCode
    ]);

    console.error(
      "Confirmation email requires review:",
      errorCode
    );

    console.log(
      "Order reference:",
      order.checkout_id
    );

    console.log(
      "Payment remains successful."
    );
  }
}

// Run the email worker safely
async function runWorker() {

  if (processing) {
    return;
  }

  processing = true;

  try {

    // Identify interrupted deliveries
    await recoverInterruptedEmails();

    // Preserve pending emails if Gmail
    // is temporarily unavailable
    const ready = await ensureSmtpReady();

    if (!ready) {
      return;
    }

    // Send the next pending email
    await processNextEmail();

  } catch (error) {

    console.error(
      "Email worker error:",
      error.code || "WORKER_ERROR"
    );

  } finally {

    processing = false;
  }
}

// Start the email reliability worker
async function start() {

  validateConfiguration();

  console.log(
    "Yearbe HTML email worker running"
  );

  console.log(
    "Development test emails only"
  );

  console.log(
    "Email recovery protection enabled"
  );

  console.log(
    "Checking pending emails every 10 seconds"
  );

  console.log(
    "Interrupted delivery threshold: 15 minutes"
  );

  console.log(
    "SMTP reconnection interval: 60 seconds"
  );

  await runWorker();

  setInterval(runWorker, WORKER_INTERVAL);
}

start().catch(async error => {

  console.error(
    "Unable to start email worker:",
    error.message
  );

  await pool.end();

  process.exitCode = 1;
});
