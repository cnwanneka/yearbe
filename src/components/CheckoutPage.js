// CheckoutPage.js
import React, { useState, useRef, useEffect } from 'react';
import { useLoadScript, Autocomplete } from "@react-google-maps/api";
import { useNavigate } from 'react-router-dom';
import './CheckoutPage.css';

function CheckoutPage() {

    const { isLoaded } = useLoadScript({
        googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY, // Ensure your .env file has this variable
        libraries: ["places"],
    });

    if (!isLoaded) return <div>Loading...</div>;



    const [deliveryDetails, setDeliveryDetails] = useState({ address: '', title: 'Mrs', firstName: '', lastName: '', mobile: '', email: '' });
    const [optOut, setOptOut] = useState(false);
    const navigate = useNavigate();

    // Declare addressInputRef using useRef hook
    const addressInputRef = useRef(null);

    useEffect(() => {
        if (!addressInputRef.current) return;
    
        const autocomplete = new window.google.maps.places.Autocomplete(
            addressInputRef.current,
            { types: ['geocode'] }
        );
    
        autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            if (!place.geometry) {
                console.log('No details available for input:', place.name);
                return;
            }
    
            // Update the address in the state
            setDeliveryDetails({ ...deliveryDetails, address: place.formatted_address });
        });
    }, []);
    

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
                        <Autocomplete>
                            <input type="text" name="address" placeholder="Enter your address" ref={addressInputRef} onChange={handleFormChange} />
                        </Autocomplete>
                        <p>Address Manually</p>
                        {/* Add logic for address suggestions here */}
                    </form>
                </div>
                <div className="column">
                    <h2>2. Your Details</h2>
                    <form>
                        <div className="form-row">
                            <select name="title" onChange={handleFormChange} value={deliveryDetails.title}>
                                <option value="Mr">Mr</option>
                                <option value="Mrs">Mrs</option>
                                <option value="Miss">Miss</option>
                                <option value="Ms">Ms</option>
                                <option value="Dr">Dr</option>
                                <option value="Mx">Mx</option>
                                <option value="Other">Other</option>
                            </select>
                            <input type="text" name="firstName" placeholder="First Name" onChange={handleFormChange} />
                            <input type="text" name="lastName" placeholder="Last Name" onChange={handleFormChange} />
                        </div>
                        <div className="form-row">
                            <input type="tel" name="mobile" placeholder="Mobile Number" onChange={handleFormChange} />
                        </div>
                        <div className="form-row">
                            <input type="email" name="email" placeholder="Email Address" onChange={handleFormChange} />
                        </div>
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



