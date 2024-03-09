
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import axios from 'axios';
import './PaymentPage.css';

function PaymentPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const stripe = useStripe();
    const elements = useElements();
    const [email, setEmail] = useState('');
    const [nameOnCard, setNameOnCard] = useState('');

    // Retrieve delivery details from the location state
    const deliveryDetails = location.state?.deliveryDetails;

    const handlePayment = async (e) => {
        e.preventDefault();
        
        const { error, paymentMethod } = await stripe.createPaymentMethod({
            type: 'card',
            card: elements.getElement(CardElement),
        });

        if (!error) {
            const { id } = paymentMethod;
            try {
              const { data } = await axios.post('http://localhost:3001/payment', {
                token: id,
                amount: 2000, // For example, $20.00
                email,
                orderDetails: {
                  // Add your order details here
                },
              });
              alert(data.message);
              navigate('/confirmation'); // Navigate to confirmation page
            } catch (error) {
              console.log(error);
              alert('Payment failed');
            }
        }
    };
    
    return (
        <div className="payment-page-container">
            {/* Display delivery address if available */}
            {deliveryDetails && (
                <div className="billing-address">
                    <h2>1. Billing Address</h2>
                    <p>{deliveryDetails.addressLine1}</p>
                    <p>{deliveryDetails.townCity}</p>
                    <p>{deliveryDetails.postcode}</p>
                    <button onClick={() => navigate('/checkout')}>Change</button>
                </div>
            )}
            <div className="payment-form">
                <h2>2. Payment Details</h2>
                <form onSubmit={handlePayment}>
                    <div className="input-field">
                        <label htmlFor="nameOnCard" className="required-field">Name on Card</label>
                        <input
                            type="text"
                            id="nameOnCard"
                            value={nameOnCard}
                            onChange={(e) => setNameOnCard(e.target.value)}
                            placeholder="Name on card"
                            required
                        />
                    </div>
                    <div className="input-field">
                        <CardElement className="StripeElement" />
                    </div>
                    <div className="input-field">
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email address"
                            required
                        />
                    </div>
                    <button type="submit" disabled={!stripe}>
                        Pay
                    </button>
                </form>
            </div>
        </div>
    );
}

export default PaymentPage;
