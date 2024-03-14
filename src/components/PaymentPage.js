
import React, { useState, useEffect } from 'react';
import { useNavigate, } from 'react-router-dom';
import { useStripe, useElements, CardNumberElement, CardExpiryElement, CardCvcElement } from '@stripe/react-stripe-js';
import axios from 'axios';
import './PaymentPage.css';

function PaymentPage() {
    const navigate = useNavigate();
    const [deliveryDetails, setDeliveryDetails] = useState(null);
    const [amount, setAmount] = useState(); // Initially undefined

    const stripe = useStripe();
    const elements = useElements();
    

    
    useEffect(() => {
        // Assuming you store the total amount in local storage
        const total = parseFloat(localStorage.getItem('totalAmount'));
        if (!isNaN(total)) {
            setAmount(total);
        }
    
        // Retrieve delivery details
        const storedDetails = JSON.parse(localStorage.getItem('deliveryDetails'));
        if (storedDetails) {
            setDeliveryDetails(storedDetails);
        }
    }, []);
    

    const handlePayment = async (e) => {
        e.preventDefault();
        
        if (!stripe || !elements) {
            // Stripe.js has not yet loaded.
            // Make sure to disable form submission until Stripe.js has loaded.
            console.log('Stripe has not loaded yet!');
            return;
        }
    
        const cardElement = elements.getElement(CardNumberElement);
    
        if (!cardElement) {
            console.log('CardNumberElement not found');
            return;
        }
    
        const {error, paymentMethod} = await stripe.createPaymentMethod({
            type: 'card',
            card: cardElement,
        });
    
        if (error) {
            console.log('[error]', error);
            alert('Payment failed: ' + error.message);
        } else {
            try {
                const { data } = await axios.post('http://localhost:3001/payment', {
                    token: paymentMethod.id,
                    amount: amount * 100, // For example, £9.95 becomes 995 in cents
                    orderDetails: {
                        // Your order details here
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
                                <pre>{deliveryDetails.address}</pre>
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
                        <label>Card Number</label>
                        <CardNumberElement className="StripeElement" options={{ placeholder: "1234 5678 9012 3456" }} />
                    </div>
                    <div className="expiry-cvv-field">
                        <div className="input-field half-width">
                            <label>Expiry MM/YY</label>
                            <CardExpiryElement className="StripeElement" options={{ placeholder: "MM/YY" }} />
                        </div>
                        <div className="input-field half-width">
                            <label>CVV</label>
                            <CardCvcElement className="StripeElement" options={{ placeholder: "3 digits" }} />
                        </div>
                    </div>
                    <button type="submit">
                        Pay £{amount?.toFixed(2)}
                    </button>


                </form>
            </div>

        </div>
    );
}

export default PaymentPage;
