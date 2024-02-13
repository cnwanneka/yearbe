// CheckoutPage.js

import React, { useState, useRef, useEffect } from 'react';
import { debounce } from 'lodash';
import axios from 'axios'; 
import { useLoadScript } from '@react-google-maps/api';
import { useNavigate } from 'react-router-dom';
import './CheckoutPage.css';

const libraries = ["places"];
  
function CheckoutPage() {
    console.log("CheckoutPage is rendering");
    const { isLoaded, loadError } = useLoadScript({
        googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
        libraries,
    });
    
    const addressInputRef = useRef(null);
    const [deliveryDetails, setDeliveryDetails] = useState({ address: '', title: 'Mrs', firstName: '', lastName: '', mobile: '', email: '' });
    const [optOut, setOptOut] = useState(false);
    const navigate = useNavigate();
    const deliveryDetailsRef = useRef(deliveryDetails);

    const [userInput, setUserInput] = useState(''); // To store user's input for addresses or postcodes
    const [addressOptions, setAddressOptions] = useState([]); // To store fetched addresses
    const debouncedFetchAddresses = useRef(); // To store the debounced fetch function
    
    const [isMounted, setIsMounted] = useState(false);


    useEffect(() => {
        setIsMounted(true);
        return () => setIsMounted(false); // Cleanup function
    }, []);

    useEffect(() => {
        console.log("Script loaded:", isLoaded);
        if (isMounted && addressInputRef.current && isLoaded) {
            console.log("Component mounted and ref is attached:", addressInputRef.current);
    
            const autocomplete = new window.google.maps.places.Autocomplete(
                addressInputRef.current,
                {
                    types: ['geocode'], // Focus on address types
                    componentRestrictions: { country: "GB" } // Restrict to the UK
                }
            );
    
            const handlePlaceSelect = () => {
                const place = autocomplete.getPlace();
                if (!place.geometry) {
                    console.log('No details available for input:', place.name);
                    return;
                }
                // Update the address in the state
                setDeliveryDetails({ ...deliveryDetailsRef.current, address: place.formatted_address });
            };

            autocomplete.addListener('place_changed', handlePlaceSelect);

            // Cleanup function
            return () => {
                window.google.maps.event.clearInstanceListeners(autocomplete);
            };
        }    
    }, [isMounted, addressInputRef, isLoaded, setDeliveryDetails]); // Ensure addressInputRef is listed as a dependency if using strict mode

    useEffect(() => {
        deliveryDetailsRef.current = deliveryDetails;
    }, [deliveryDetails]);
    
    const fetchAddresses = async (input) => {
        const apiKey = process.env.REACT_APP_GETADDRESS_IO_API_KEY;
        if (!input.trim()) return; // Avoid fetching if input is only whitespace
        
        try {
            // Use encodeURIComponent to handle special characters in input
            const response = await axios.get(`https://api.getAddress.io/autocomplete/${encodeURIComponent(input)}?api-key=${apiKey}&expand=true`);
            if (response.data && response.data.suggestions) {
                const formattedAddresses = response.data.suggestions.map(suggestion => ({
                    text: suggestion.address, // Format address text as needed
                    count: suggestion.count || 'N/A' // Use 'count' from your API if available
                }));
                setAddressOptions(formattedAddresses);
            } else {
                setAddressOptions([]);
            }
        } catch (error) {
            console.error('Error fetching addresses:', error);
            setAddressOptions([]);
        }
    };
    

    useEffect(() => {
        debouncedFetchAddresses.current = debounce((input) => {
            fetchAddresses(input);
        }, 500);

        return () => {
            debouncedFetchAddresses.current.cancel();
        };
    }, []);

    const handleInputChange = (e) => {
        const input = e.target.value;
        setUserInput(input); // Update the input value state immediately
        debouncedFetchAddresses.current(input); // Use the ref if the debounced function is outside the component
    };
    

    const handleFormChange = (event) => {
        setDeliveryDetails({ ...deliveryDetails, [event.target.name]: event.target.value });
    };

    const handleOptOutChange = () => {
        setOptOut(!optOut);
    };

    const handleCheckout = (e) => {
        e.preventDefault(); // Prevent default form submission
        // add logic for proceeding to the payment step
    
        if (!deliveryDetails.address || !deliveryDetails.firstName || !deliveryDetails.lastName) {
            alert("Please fill in all required fields.");
            return;
        }

        // Navigate to a payment page or handle the payment process
        navigate('/payment'); // Example: navigate to a payment page
    };

    if (!isLoaded) return <div>Loading...</div>;

    if (loadError) {
        return <div>Error loading maps</div>;
    }
      
    console.log(addressOptions); // Debug to see what addresses are available for rendering
    return (
        <div className="checkout-container">
            <h1>Delivery</h1>
            <div className="checkout-columns">
                <div className="column">
                    <h2>1. Delivery</h2>
                    <p>Where would you like your items delivered to?</p>
                    <form onSubmit={handleCheckout}>
                        <input
                            type="text"
                            value={userInput}
                            onChange={handleInputChange}
                            placeholder="Enter your postcode or address"
                        />
                        {addressOptions.length > 0 && (
                            <select onChange={(e) => setDeliveryDetails({ ...deliveryDetails, address: e.target.value })}>
                                {addressOptions.map((option, index) => (
                                    <option key={index} value={option.text}>{`${option.text} - ${option.count} addresses`}</option>
                                ))}
                            </select>
                        )}
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



