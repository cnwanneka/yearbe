
require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const bodyParser = require('body-parser');
const cors = require('cors'); 
const nodemailer = require('nodemailer');

const app = express();
const port = 3001;

const corsOptions = {
    origin: 'http://localhost:3000',
    methods: ['POST'],
    allowedHeaders: ['Content-Type'],
};

app.use(cors(corsOptions));
app.use(bodyParser.json());

// Email configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
    }
});

// Function to send an email
const sendConfirmationEmail = (to, subject, text, html) => {
    const mailOptions = {
        from: process.env.GMAIL_USER,
        to: to,
        subject: subject,
        text: text,
        html: html
    };

    transporter.sendMail(mailOptions, function(error, info){
        if (error) {
            console.log('Error sending email: ', error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
};

// Route to handle payment
app.post('/payment', async (req, res) => {
    try {
        const { amount, paymentMethodId, paymentIntentId, deliveryDetails, cart } = req.body;

        if (!deliveryDetails || !cart) {
            throw new Error('Delivery details or cart is missing.');
        }

        let paymentIntent;
        if (paymentIntentId) {
            paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
            if (paymentIntent.status === 'succeeded') {
                console.log(`PaymentIntent ${paymentIntent.id} has already succeeded.`);
                return res.status(400).json({ error: "PaymentIntent already succeeded" });
            }
        }

        if (!paymentIntent) {
            paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'gbp',
                payment_method: paymentMethodId,
                confirmation_method: 'manual',
                confirm: true,
                return_url: 'http://localhost:3000/payment-success',
            });
        }

        if (paymentIntent.status === 'succeeded') {
            const emailBody = `
                <h1>Order Confirmation</h1>
                <p>Your payment of £${(amount / 100).toFixed(2)} has been successful.</p>
                <p>Order Details:</p>
                <ul>
                    ${cart.map(item => `<li>${item.title} - £${item.price} x ${item.quantity}</li>`).join('')}
                </ul>
                <p>Delivery Address: ${deliveryDetails.address}</p>
                <p>Thank you for your purchase!</p>`;
            sendConfirmationEmail(deliveryDetails.email, 'Your Order Confirmation', '', emailBody);

            return res.json({ clientSecret: paymentIntent.client_secret });
        } else {
            return res.json({ clientSecret: paymentIntent.client_secret });
        }

    } catch (error) {
        console.error("Stripe error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});


