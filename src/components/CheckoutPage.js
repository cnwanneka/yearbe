

import React, {
    useState,
    useRef,
    useEffect,
    useContext
} from 'react';

import { useNavigate } from 'react-router-dom';
import { CartContext } from './CartContext';
import './CheckoutPage.css';

const API_BASE = (
    process.env.REACT_APP_ADDRESS_API_BASE_URL ||
    (
        process.env.NODE_ENV === 'development'
            ? 'http://localhost:3001'
            : ''
    )
).replace(/\/+$/, '');

async function addressRequest(endpoint, body, signal) {
    const response = await fetch(
        `${API_BASE}/api/addresses/${endpoint}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body),
            signal
        }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
        throw new Error(
            data.error || 'Address lookup unavailable'
        );
    }

    return data;
}

function CheckoutPage() {

    const { cart } = useContext(CartContext);
    const navigate = useNavigate();

    const [deliveryDetails, setDeliveryDetails] = useState({
        address: '',
        title: 'Mrs',
        firstName: '',
        lastName: '',
        mobile: '',
        email: '',
        addressLine1: '',
        addressLine2: '',
        addressLine3: '',
        townCity: '',
        postcode: '',
        optOut: false
    });

    const [userInput, setUserInput] = useState('');
    const [addressOptions, setAddressOptions] = useState([]);
    const [isManualEntry, setIsManualEntry] = useState(false);

    const [searching, setSearching] = useState(false);
    const [resolving, setResolving] = useState(false);
    const [addressError, setAddressError] = useState('');

    const resolveController = useRef(null);


    // Retrieve address suggestions automatically
    useEffect(() => {

        const query = userInput.trim();

        if (
            isManualEntry ||
            deliveryDetails.address ||
            query.length < 3
        ) {
            return;
        }

        const controller = new AbortController();

        const timeout = setTimeout(async () => {

            try {
                setSearching(true);
                setAddressError('');

                const data = await addressRequest(
                    'search',
                    { query },
                    controller.signal
                );

                if (controller.signal.aborted) {
                    return;
                }

                setAddressOptions(data.suggestions);

                if (data.suggestions.length === 0) {
                    setAddressError(
                        'No addresses found. Try another search or enter your address manually.'
                    );
                }

            } catch (error) {

                if (!controller.signal.aborted) {

                    setAddressOptions([]);

                    setAddressError(
                        error.message ||
                        'Error fetching addresses'
                    );
                }

            } finally {

                if (!controller.signal.aborted) {
                    setSearching(false);
                }
            }

        }, 400);

        return () => {
            clearTimeout(timeout);
            controller.abort();
        };

    }, [
        userInput,
        isManualEntry,
        deliveryDetails.address
    ]);


    // Cancel address resolution when leaving the page
    useEffect(() => {

        return () => {
            resolveController.current?.abort();
        };

    }, []);


    // Handle address search input
    const handleSearchChange = (event) => {

        resolveController.current?.abort();

        setResolving(false);
        setSearching(false);
        setAddressOptions([]);
        setAddressError('');
        setUserInput(event.target.value);
    };


    // Update delivery and contact details
    const handleFormChange = (event) => {

        const { name, value } = event.target;

        setDeliveryDetails(previousDetails => ({
            ...previousDetails,
            [name]: value
        }));
    };


    // Check required address fields
    const isAddressValid = () => {

        const {
            addressLine1,
            townCity,
            postcode
        } = deliveryDetails;

        return Boolean(
            addressLine1.trim() &&
            townCity.trim() &&
            postcode.trim()
        );
    };


    // Format address including optional address lines
    const formatAddress = (addressDetails) => {

        return [
            addressDetails.addressLine1,
            addressDetails.addressLine2,
            addressDetails.addressLine3,
            addressDetails.townCity,
            addressDetails.postcode
        ]
            .filter(line =>
                typeof line === 'string' && line.trim()
            )
            .map(line => line.trim().toUpperCase())
            .join('\n');
    };


    // Retrieve the full selected address
    const handleAddressSelection = async (event) => {

        const selectedId = event.target.value;

        if (!selectedId) {
            return;
        }

        resolveController.current?.abort();

        const controller = new AbortController();

        resolveController.current = controller;

        try {

            setResolving(true);
            setAddressError('');

            const data = await addressRequest(
                'resolve',
                { id: selectedId },
                controller.signal
            );

            if (controller.signal.aborted) {
                return;
            }

            const selectedAddress = data.address;

            const formattedAddress =
                formatAddress(selectedAddress);

            setDeliveryDetails(previousDetails => ({
                ...previousDetails,
                ...selectedAddress,
                address: formattedAddress
            }));

            setAddressOptions([]);
            setUserInput('');
            setSearching(false);

        } catch (error) {

            if (!controller.signal.aborted) {
                setAddressError(
                    error.message ||
                    'Unable to retrieve address'
                );
            }

        } finally {

            if (!controller.signal.aborted) {
                setResolving(false);
            }
        }
    };


    // Switch to manual address entry
    const openManualEntry = () => {

        resolveController.current?.abort();

        setResolving(false);
        setSearching(false);
        setAddressOptions([]);
        setAddressError('');
        setUserInput('');

        setDeliveryDetails(previousDetails => ({
            ...previousDetails,
            address: ''
        }));

        setIsManualEntry(true);
    };


    // Confirm manually entered address
    const useManualAddress = () => {

        if (!isAddressValid()) {
            alert('Please fill in all required fields.');
            return;
        }

        const addressDetails = {
            addressLine1:
                deliveryDetails.addressLine1.trim(),

            addressLine2:
                deliveryDetails.addressLine2.trim(),

            addressLine3:
                deliveryDetails.addressLine3.trim(),

            townCity:
                deliveryDetails.townCity.trim(),

            postcode:
                deliveryDetails.postcode.trim().toUpperCase()
        };

        setDeliveryDetails(previousDetails => ({
            ...previousDetails,
            ...addressDetails,
            address: formatAddress(addressDetails)
        }));

        setIsManualEntry(false);
        setAddressError('');
    };


    // Return to automatic address lookup
    const returnToAddressSearch = () => {

        resolveController.current?.abort();

        setIsManualEntry(false);
        setResolving(false);
        setSearching(false);
        setAddressOptions([]);
        setAddressError('');
        setUserInput('');

        setDeliveryDetails(previousDetails => ({
            ...previousDetails,
            address: '',
            addressLine1: '',
            addressLine2: '',
            addressLine3: '',
            townCity: '',
            postcode: ''
        }));
    };


    // Marketing opt-out preference
    const handleOptOutChange = () => {

        setDeliveryDetails(previousDetails => ({
            ...previousDetails,
            optOut: !previousDetails.optOut
        }));
    };


    // Existing Yearbe bedsheet checkout
    const handleCheckout = (event) => {

        event.preventDefault();

        if (cart.length === 0) {
            alert('Your basket is empty.');
            navigate('/basket');
            return;
        }

        if (
            !deliveryDetails.address ||
            !deliveryDetails.firstName.trim() ||
            !deliveryDetails.lastName.trim() ||
            !deliveryDetails.email.trim()
        ) {
            alert('Please fill in all required fields.');
            return;
        }

        // Preserve existing Yearbe checkout behaviour
        localStorage.setItem(
            'deliveryDetails',
            JSON.stringify(deliveryDetails)
        );

        // Only existing Yearbe products are included
        localStorage.setItem(
            'cart',
            JSON.stringify(cart)
        );

        navigate('/payment');
    };


    // Manual address form
    const renderManualEntryForm = () => {

        return (
            <div className="manual-entry-form">

                <h2>1. Delivery</h2>

                <p>
                    Where would you like your items delivered to?
                </p>

                <div className="form-field">
                    <input
                        type="text"
                        name="addressLine1"
                        placeholder="Address Line 1"
                        value={deliveryDetails.addressLine1}
                        onChange={handleFormChange}
                        autoComplete="address-line1"
                        required
                    />
                </div>

                <div className="form-field">
                    <input
                        type="text"
                        name="addressLine2"
                        placeholder="Address Line 2 - Optional"
                        value={deliveryDetails.addressLine2}
                        onChange={handleFormChange}
                        autoComplete="address-line2"
                    />
                </div>

                <div className="form-field">
                    <input
                        type="text"
                        name="addressLine3"
                        placeholder="Address Line 3 - Optional"
                        value={deliveryDetails.addressLine3}
                        onChange={handleFormChange}
                        autoComplete="address-line3"
                    />
                </div>

                <div className="form-field">
                    <input
                        type="text"
                        name="townCity"
                        placeholder="Town or City"
                        value={deliveryDetails.townCity}
                        onChange={handleFormChange}
                        autoComplete="address-level2"
                        required
                    />
                </div>

                <div className="form-field">
                    <input
                        type="text"
                        name="postcode"
                        placeholder="Postcode"
                        value={deliveryDetails.postcode}
                        onChange={handleFormChange}
                        autoComplete="postal-code"
                        required
                    />
                </div>

                <div className="form-field">
                    <button
                        type="button"
                        onClick={useManualAddress}
                        disabled={!isAddressValid()}
                    >
                        Use This Address
                    </button>
                </div>

                <button
                    type="button"
                    className="manual-entry-link"
                    onClick={returnToAddressSearch}
                >
                    Search for Address Instead
                </button>

            </div>
        );
    };


    return (

        <div className="checkout-container">

            <h1>Delivery</h1>

            <div className="checkout-columns">

                {deliveryDetails.address ? (

                    <div className="column">

                        <h2>1. Delivery</h2>

                        <div>

                            <h3>Delivery Address</h3>

                            <pre>
                                {deliveryDetails.address}
                            </pre>

                            <button
                                type="button"
                                className="manual-entry-link"
                                onClick={openManualEntry}
                            >
                                Edit Address
                            </button>

                            <button
                                type="button"
                                className="manual-entry-link"
                                onClick={returnToAddressSearch}
                            >
                                Find Another Address
                            </button>

                        </div>

                    </div>

                ) : isManualEntry ? (

                    renderManualEntryForm()

                ) : (

                    <div className="column">

                        <h2>1. Delivery</h2>

                        <p>
                            Enter your UK postcode or address.
                        </p>

                        <input
                            type="text"
                            value={userInput}
                            onChange={handleSearchChange}
                            placeholder="Enter your postcode or address"
                            aria-label="Search for delivery address"
                            autoComplete="off"
                            disabled={resolving}
                            maxLength={120}
                        />

                        <button
                            className="manual-entry-link"
                            onClick={openManualEntry}
                            type="button"
                        >
                            Enter Address Manually
                        </button>

                        {searching && (
                            <p>Searching for addresses...</p>
                        )}

                        {resolving && (
                            <p>Retrieving selected address...</p>
                        )}

                        {addressError && (
                            <p
                                role="alert"
                                style={{ color: '#b45309' }}
                            >
                                {addressError}
                            </p>
                        )}

                        {addressOptions.length > 0 && (

                            <select
                                value=""
                                onChange={handleAddressSelection}
                                disabled={resolving}
                                aria-label="Select your address"
                            >

                                <option value="">
                                    Please select your address
                                </option>

                                {addressOptions.map(option => (

                                    <option
                                        key={option.id}
                                        value={option.id}
                                    >
                                        {option.text}
                                    </option>

                                ))}

                            </select>

                        )}

                    </div>
                )}


                <div className="column">

                    <h2>2. Your Details</h2>

                    <form onSubmit={handleCheckout}>

                        <div className="form-row">

                            <select
                                name="title"
                                onChange={handleFormChange}
                                value={deliveryDetails.title}
                                aria-label="Title"
                            >
                                <option value="Mr">Mr</option>
                                <option value="Mrs">Mrs</option>
                                <option value="Miss">Miss</option>
                                <option value="Ms">Ms</option>
                                <option value="Dr">Dr</option>
                                <option value="Mx">Mx</option>
                                <option value="Other">Other</option>
                            </select>

                            <input
                                type="text"
                                name="firstName"
                                placeholder="First Name"
                                value={deliveryDetails.firstName}
                                onChange={handleFormChange}
                                autoComplete="given-name"
                                required
                            />

                            <input
                                type="text"
                                name="lastName"
                                placeholder="Last Name"
                                value={deliveryDetails.lastName}
                                onChange={handleFormChange}
                                autoComplete="family-name"
                                required
                            />

                        </div>

                        <div className="form-row">

                            <input
                                type="tel"
                                name="mobile"
                                placeholder="Mobile Number"
                                value={deliveryDetails.mobile}
                                onChange={handleFormChange}
                                autoComplete="tel"
                            />

                        </div>

                        <div className="form-row">

                            <input
                                type="email"
                                name="email"
                                placeholder="Email Address"
                                value={deliveryDetails.email}
                                onChange={handleFormChange}
                                autoComplete="email"
                                required
                            />

                        </div>

                        <input
                            id="marketing-opt-out"
                            type="checkbox"
                            checked={deliveryDetails.optOut}
                            onChange={handleOptOutChange}
                        />

                        <label htmlFor="marketing-opt-out">

                            We'll stay in touch with offers that
                            you might like, see our privacy
                            policy for details. If you'd prefer
                            we didn't, just opt out by ticking
                            the box.

                        </label>

                        <p>
                            By continuing, I agree to the Terms
                            and Conditions and Privacy Policy.
                        </p>

                        <button
                            type="submit"
                            disabled={
                                !deliveryDetails.address ||
                                resolving ||
                                cart.length === 0
                            }
                        >
                            Continue to Payment
                        </button>

                    </form>

                </div>

            </div>

        </div>
    );
}

export default CheckoutPage;
