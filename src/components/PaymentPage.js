
import React, { useState, useEffect } from 'react';
import { useNavigate, } from 'react-router-dom';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import axios from 'axios';
import './PaymentPage.css';

function PaymentPage() {
    const navigate = useNavigate();
    const [deliveryDetails, setDeliveryDetails] = useState(null);
    const stripe = useStripe();
    const elements = useElements();
    const [email, setEmail] = useState('');
    const [nameOnCard, setNameOnCard] = useState('');

    
    useEffect(() => {
        // Retrieve and parse the delivery details from local storage
        const storedDetails = JSON.parse(localStorage.getItem('deliveryDetails'));
        if (storedDetails) {
            setDeliveryDetails(storedDetails);
        }
    }, []);

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
              handlePaymentSuccess();
            } catch (error) {
              console.log(error);
              alert('Payment failed');
            }
        }
    };



    const handleChangeAddress = () => {
        // Optionally clear or prepare to update local storage
        localStorage.removeItem('deliveryDetails');
        
        navigate('/checkout');
    };

    const handlePaymentSuccess = () => {
        // Clear delivery details from local storage
        localStorage.removeItem('deliveryDetails');
    
        // Navigate to confirmation or another page
        navigate('/confirmation');
    };
    
    
    
    return (
        <div className="payment-page-container">
            <div className="billing-address">
                <h2>1. Billing Address</h2>
                <div className="address-container">
                    {deliveryDetails ? (
                        <>
                            <div className="address-details">
                                <p>{deliveryDetails.address}</p>
                            </div>
                            <button onClick={handleChangeAddress} className="change-button">Change</button>
                        </>
                    ) : (
                        <p>Billing address not found.</p>
                    )}
                </div>
            </div>

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
