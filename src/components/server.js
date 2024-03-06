require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');

const app = express();
const port = 3001; // Can be any port that's free

app.use(bodyParser.json());

// Route to handle payment
app.post('/payment', async (req, res) => {
  try {
    const { amount, token, email, orderDetails } = req.body;
    const charge = await stripe.charges.create({
      amount: amount, // amount in pence
      currency: 'gbp',
      source: token, // obtained with Stripe.js
      description: 'Payment for order',
    });

    // Setup Nodemailer to send an email
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_PASS,
        },
    });
      

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: 'Order Confirmation',
      text: `Thank you. Your card payment was successful. Payment reference: ${charge.id}. Payment Date: ${new Date(charge.created * 1000).toLocaleDateString()}. Paid by: ${charge.billing_details.name}.`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log(error);
        res.status(500).send('Error sending email');
      } else {
        console.log('Email sent: ' + info.response);
        res.json({ message: 'Payment successful, email sent', charge });
      }
    });

  } catch (error) {
    console.log(error);
    res.status(500).send('Payment failed');
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
