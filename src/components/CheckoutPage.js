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
    
    const [deliveryDetails, setDeliveryDetails] = useState({ address: '', title: 'Mrs', firstName: '', lastName: '', mobile: '', email: '' });
    const [userInput, setUserInput] = useState(''); // To store user's input for addresses or postcodes
    const [addressOptions, setAddressOptions] = useState([]); // To store fetched addresses
    const debouncedFetchAddresses = useRef(); // To store the debounced fetch function
    const navigate = useNavigate();

    useEffect(() => {
        debouncedFetchAddresses.current = debounce((input) => {
            fetchAddresses(input);
        }, 300); // Adjust debounce timing as needed

        return () => {
            if (debouncedFetchAddresses.current.cancel) {
                debouncedFetchAddresses.current.cancel();
            }
        };
    }, []);

    const fetchAddresses = async (input) => {
        if (input.length < 2) return;
    
        const apiKey = process.env.REACT_APP_GETADDRESS_IO_API_KEY;
        try {
            const response = await axios.get(`https://api.getAddress.io/autocomplete/${encodeURIComponent(input)}?api-key=${apiKey}&all=true`);
            if (response.data && response.data.suggestions) {
                const suggestions = response.data.suggestions.map(suggestion => ({
                    text: suggestion.address, // Response directly gives address text
                    value: suggestion.url, // Use the 'url' as a unique identifier for the address
                    id: suggestion.id // Use the 'id' as a unique identifier for the address
                }));
                setAddressOptions(suggestions);
            } else {
                setAddressOptions([{text: "No results found", value: "", id: ""}]);
            }
        } catch (error) {
            console.error('Error fetching addresses:', error);
            setAddressOptions([{text: "Error fetching addresses", value: "", id: ""}]);
        }
    };

    
    const handleAddressSelection = (e) => {
        const selectedUrl = e.target.value;
        const selectedOption = addressOptions.find(option => option.value === selectedUrl);
    
        if (selectedOption) {
            setDeliveryDetails({ ...deliveryDetails, address: selectedOption.text });
        }
    };
    
    

    const handleFormChange = (event) => {
        setDeliveryDetails({ ...deliveryDetails, [event.target.name]: event.target.value });
    };

    const handleOptOutChange = () => {
        // Correctly toggle the optOut value within the deliveryDetails state
        setDeliveryDetails(prevDetails => ({
            ...prevDetails,
            optOut: !prevDetails.optOut // Correctly toggle the boolean value
        }));
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
                    <form onSubmit={handleCheckout}>
                        <input
                            type="text"
                            value={userInput}
                            onChange={(e) => {
                                setUserInput(e.target.value);
                                if (e.target.value.length >= 2) {
                                    debouncedFetchAddresses.current(e.target.value);
                                }
                            }}
                            placeholder="Enter your postcode or address"
                        />
                        {addressOptions.length > 0 && (
                            <select onChange={handleAddressSelection} aria-label="Select your address or postcode">
                                {addressOptions.map((option, index) => (
                                    <option key={index} value={option.value}>{option.text}</option>
                                ))}
                            </select>
                        )}
                    </form>
                    
                    {deliveryDetails.address && (
                        <div>
                            <h3>Delivery Address</h3>
                            <p>{deliveryDetails.address}</p>
                        </div>
                    )}
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
                        <input 
                            type="checkbox" 
                            checked={deliveryDetails.optOut} // Correctly reference optOut from deliveryDetails
                            onChange={handleOptOutChange} 
                        />
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



