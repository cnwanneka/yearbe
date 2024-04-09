
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStripe, useElements, CardNumberElement, CardExpiryElement, CardCvcElement } from '@stripe/react-stripe-js';
import axios from 'axios';
import './PaymentPage.css';

function PaymentPage() {
    const navigate = useNavigate();
    const [deliveryDetails, setDeliveryDetails] = useState(null);
    const [amount, setAmount] = useState();
    const [isProcessing, setIsProcessing] = useState(false); // State to track if payment is processing
    const stripe = useStripe();
    const elements = useElements();

    useEffect(() => {
        const total = parseFloat(localStorage.getItem('totalAmount'));
        if (!isNaN(total)) {
            setAmount(total * 100); // Convert amount to cents
        }

        const storedDetails = JSON.parse(localStorage.getItem('deliveryDetails'));
        if (storedDetails) {
            setDeliveryDetails(storedDetails);
        }
    }, []);

    const handlePayment = async (e) => {
      e.preventDefault();
      if (!stripe || !elements || isProcessing) {
          console.log('Payment is already being processed or Stripe is not fully loaded.');
          return;
      }
  
      setIsProcessing(true);
  
      const cardElement = elements.getElement(CardNumberElement);
      if (!cardElement) {
          console.log('CardNumberElement not found');
          setIsProcessing(false);
          return;
      }
  
      try {
          const paymentMethodResponse = await stripe.createPaymentMethod({
              type: 'card',
              card: cardElement,
          });
  
          if (paymentMethodResponse.error) {
              console.log(paymentMethodResponse.error.message);
              alert('Payment failed: ' + paymentMethodResponse.error.message);
              return;
          }
  
          const response = await axios.post('http://localhost:3001/payment', {
              paymentMethodId: paymentMethodResponse.paymentMethod.id,
              amount: amount,
          });
  
          const { clientSecret } = response.data;
  
          const result = await stripe.confirmCardPayment(clientSecret, {
              payment_method: paymentMethodResponse.paymentMethod.id,
          });
  
          if (result.error) {
              if (result.error.code === "payment_intent_unexpected_state") {
                  console.log('Payment Intent has already been confirmed.');
                  navigate('/confirmation');
              } else {
                  console.error(result.error.message);
                  alert("Payment error: " + result.error.message);
              }
          } else if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
              console.log('Payment successful');
              handlePaymentSuccess();
          }
      } catch (error) {
          console.error(error);
          alert('Payment processing error');
      } finally {
          setIsProcessing(false);
      }
    };
  

    const handleChangeAddress = () => {
        localStorage.removeItem('deliveryDetails');
        navigate('/checkout');
    };

    const handlePaymentSuccess = () => {
        localStorage.removeItem('deliveryDetails');
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
                  <button type="submit" disabled={isProcessing}>
                      {isProcessing ? 'Processing…' : `Pay £${(amount / 100).toFixed(2)}`}
                  </button>
              </form>
          </div>
      </div>
    );
}

export default PaymentPage;


