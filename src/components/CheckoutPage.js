// CheckoutPage.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './CheckoutPage.css';

function CheckoutPage() {
    const [deliveryDetails, setDeliveryDetails] = useState({ address: '', title: 'Mrs', firstName: '', lastName: '', mobile: '', email: '' });
    const [optOut, setOptOut] = useState(false);
    const navigate = useNavigate();

    const handleFormChange = (event) => {
        setDeliveryDetails({ ...deliveryDetails, [event.target.name]: event.target.value });
    };

    const handleOptOutChange = () => {
        setOptOut(!optOut);
    };

    const handleCheckout = () => {
        // add logic for proceeding to the payment step
    
        if (!deliveryDetails.address || !deliveryDetails.firstName || !deliveryDetails.lastName) {
            alert("Please fill in all required fields.");
            return;
        }

        // Navigate to a payment page or handle the payment process
        navigate('/payment'); // Example: navigate to a payment page
    };

    return (
        <div className="checkout-container">
            <h1>Delivery</h1>
            <div className="checkout-columns">
                <div className="column">
                    <h2>1. Delivery</h2>
                    <p>Where would you like your items delivered to?</p>
                    <form>
                        <input type="text" name="address" placeholder="Enter your postcode or address" onChange={handleFormChange} />
                        <p>Enter Address Manually</p>
                        {/* Add logic for address suggestions here */}
                    </form>
                </div>
                <div className="column">
                    <h2>2. Your Details</h2>
                    <form>
                        {/* Additional form fields */}
                        <select name="title" onChange={handleFormChange} value={deliveryDetails.title}>
                            <option value="Mrs">Mrs</option>
                            {/* Add other options */}
                        </select>
                        {/* Add input fields for firstName, lastName, mobile, and email */}
                        <input type="checkbox" checked={optOut} onChange={handleOptOutChange} />
                        <p>We'll stay in touch with offers that you might like, see our privacy policy for details. If you'd prefer we didn't, just opt out by ticking the box.</p>
                        <p>By continuing, I agree to the Terms and Conditions and Privacy Policy
                        </p>
                        <button onClick={handleCheckout}>Continue to Payment</button>
                    </form>
                </div>
            </div>
        </div>
    );
}    

export default CheckoutPage;



