
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
        const { amount, paymentMethodId, paymentIntentId } = req.body;

        let paymentIntent;
        if (paymentIntentId) {
            // Attempt to retrieve an existing PaymentIntent
            paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

            // Check if the retrieved PaymentIntent has already succeeded
            if (paymentIntent.status === 'succeeded') {
                console.log(`PaymentIntent ${paymentIntent.id} has already succeeded.`);
                return res.status(400).json({ error: "PaymentIntent already succeeded" });
            }
        }

        // Proceed with creating a new PaymentIntent if none exists or if the existing one has not succeeded
        if (!paymentIntent) {
            paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'gbp',
                payment_method: paymentMethodId,
                confirmation_method: 'manual',
                confirm: true,
                // Include the return_url in your PaymentIntent creation
                return_url: 'http://localhost:3000/payment-success',
            });
        }

        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        console.error("Stripe error:", error); // Detailed log for debugging
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
