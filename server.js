
require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const bodyParser = require('body-parser');
const cors = require('cors'); // Require CORS

const app = express();
const port = 3001; // Can be any port that's free

const corsOptions = {
  origin: 'http://localhost:3000',
  methods: ['POST'], // Only allow POST requests from the specified origin
  allowedHeaders: ['Content-Type'],
};

app.use(cors(corsOptions));

app.use(bodyParser.json());

// Route to handle payment
app.post('/payment', async (req, res) => {
  try {
    const { amount, paymentMethodId } = req.body;

    // Define your return URL. This should be a route in your app that can handle the next steps.
    const return_url = 'http://localhost:3000/payment-success';

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'gbp',
      payment_method: paymentMethodId,
      confirmation_method: 'manual',
      confirm: true,
      // Include the return_url in your PaymentIntent creation
      return_url: return_url,
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("Stripe error:", error); // Detailed log for debugging
    res.status(500).json({ error: error.message });
  }
});



app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
