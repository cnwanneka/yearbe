

require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const nodemailer = require("nodemailer");

const cjCatalogue = require("./routes/cjCatalogue");
const addressLookup = require("./routes/addressLookup");
const bedsheetPayment = require("./routes/bedsheetPayment");

const app = express();
const port = 3001;

const corsOptions = {
  origin: [
    "http://localhost:3000",
    "https://yearbe.com"
  ],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
};

app.use(cors(corsOptions));

// Stripe webhook must be registered BEFORE
// the JSON body parser
app.post(
  "/payment/webhook",
  express.raw({
    type: "application/json"
  }),
  bedsheetPayment.handleWebhook
);

// JSON parser for all other routes
app.use(bodyParser.json());

// Address lookup
app.use(
  "/api/addresses",
  addressLookup
);

// Yearbe bedsheet payments
app.use(
  "/payment",
  bedsheetPayment
);

// CJ development preview only
if (
  process.env.NODE_ENV !== "production" &&
  process.env.YEARBE_CATALOGUE_PREVIEW === "1"
) {

  app.use(
    "/api/cj",
    cjCatalogue
  );

}

// Existing email configuration
const transporter = nodemailer.createTransport({
  service: "gmail",

  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

// Existing email confirmation function
const sendConfirmationEmail = (
  to,
  subject,
  text,
  html
) => {

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to,
    subject,
    text,
    html
  };

  transporter.sendMail(
    mailOptions,
    function (error, info) {

      if (error) {

        console.log(
          "Error sending email:",
          error
        );

      } else {

        console.log(
          "Email sent:",
          info.response
        );

      }
    }
  );
};

app.listen(port, () => {

  console.log(
    `Server running on port ${port}`
  );

  console.log(
    "Stripe webhook endpoint: /payment/webhook"
  );

});
