

import React, {
    useState,
    useEffect,
    useRef,
    useCallback,
    useContext
} from 'react';

import { useNavigate } from 'react-router-dom';

import {
    useStripe,
    useElements,
    CardNumberElement,
    CardExpiryElement,
    CardCvcElement
} from '@stripe/react-stripe-js';

import { CartContext } from './CartContext';

import axios from 'axios';
import './PaymentPage.css';

const API_BASE_URL =
    process.env.REACT_APP_PAYMENT_API_BASE_URL ||
    (
        process.env.NODE_ENV === 'development'
            ? 'http://localhost:3001'
            : ''
    );

const CHECKOUT_KEY = 'yearbeBedsheetCheckoutId';

function readStorage(key, fallback) {
    try {
        return JSON.parse(
            localStorage.getItem(key)
        ) ?? fallback;
    } catch {
        return fallback;
    }
}

function PaymentPage() {

    const navigate = useNavigate();

    // Access Yearbe basket-clearing function
    const { clearBedsheetCart } =
        useContext(CartContext);

    const [deliveryDetails] = useState(
        () => readStorage('deliveryDetails', null)
    );

    const [cart] = useState(
        () => readStorage('cart', [])
    );

    const [amount, setAmount] = useState(null);

    const [loading, setLoading] = useState(true);

    const [isProcessing, setIsProcessing] =
        useState(false);

    const [error, setError] = useState('');

    const [hasAttempt, setHasAttempt] = useState(
        () => Boolean(
            localStorage.getItem(CHECKOUT_KEY)
        )
    );

    const processingRef = useRef(false);

    const stripe = useStripe();
    const elements = useElements();

    // Handle a successfully verified payment
    const handlePaymentSuccess = useCallback(() => {

        // Clear Yearbe products from React state
        // and localStorage
        clearBedsheetCart();

        // Remove completed checkout information
        localStorage.removeItem('deliveryDetails');
        localStorage.removeItem('cart');
        localStorage.removeItem('totalAmount');
        localStorage.removeItem(CHECKOUT_KEY);

        // Redirect to payment confirmation
        navigate('/confirmation', {
            replace: true
        });

    }, [navigate, clearBedsheetCart]);

    // Recover interrupted payments and
    // retrieve trusted prices from the backend
    useEffect(() => {

        const controller = new AbortController();

        async function initialisePayment() {

            let recoveryMessage = '';

            try {

                setLoading(true);
                setError('');

                const checkoutId =
                    localStorage.getItem(CHECKOUT_KEY);

                // Recover an existing payment
                // after a browser refresh
                if (checkoutId) {

                    setHasAttempt(true);

                    try {

                        const recovery = await axios.post(
                            `${API_BASE_URL}/payment/verify`,
                            { checkoutId },
                            {
                                signal: controller.signal
                            }
                        );

                        if (
                            controller.signal.aborted ||
                            localStorage.getItem(CHECKOUT_KEY)
                                !== checkoutId
                        ) {
                            return;
                        }

                        if (
                            recovery.data.success === true &&
                            recovery.data.paid === true &&
                            Number.isSafeInteger(
                                recovery.data.amount
                            ) &&
                            recovery.data.amount > 0
                        ) {

                            console.log(
                                'Existing payment recovered successfully'
                            );

                            handlePaymentSuccess();
                            return;
                        }

                        recoveryMessage =
                            'Previous payment has not yet been confirmed.';

                    } catch (err) {

                        if (controller.signal.aborted) {
                            return;
                        }

                        recoveryMessage =
                            'Previous payment could not yet be verified.';

                        console.log(
                            'Payment recovery:',
                            err.response?.data?.error ||
                            err.message
                        );
                    }
                }

                // Retrieve trusted prices for unpaid baskets
                const response = await axios.post(
                    `${API_BASE_URL}/payment/quote`,
                    { cart },
                    {
                        signal: controller.signal
                    }
                );

                if (controller.signal.aborted) {
                    return;
                }

                if (
                    !response.data.success ||
                    !Number.isSafeInteger(
                        response.data.amount
                    ) ||
                    response.data.amount <= 0
                ) {
                    throw new Error(
                        'Invalid payment amount'
                    );
                }

                setAmount(response.data.amount);

                if (recoveryMessage) {
                    setError(recoveryMessage);
                }

            } catch (err) {

                if (!controller.signal.aborted) {

                    setError(
                        err.response?.data?.error ||
                        err.message ||
                        'Unable to initialise payment'
                    );
                }

            } finally {

                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        initialisePayment();

        return () => controller.abort();

    }, [cart, handlePaymentSuccess]);

    // Verify payment before displaying confirmation
    const verifyPayment = async (checkoutId) => {

        const response = await axios.post(
            `${API_BASE_URL}/payment/verify`,
            { checkoutId }
        );

        if (
            !response.data.success ||
            response.data.paid !== true ||
            response.data.amount !== amount
        ) {
            throw new Error(
                'Payment could not be verified'
            );
        }

        // Clear basket only after backend verification
        handlePaymentSuccess();
    };

    // Process or resume an existing payment
    const handlePayment = async (event) => {

        event.preventDefault();

        if (
            loading ||
            !stripe ||
            !elements ||
            processingRef.current ||
            !deliveryDetails ||
            !Number.isSafeInteger(amount) ||
            amount <= 0
        ) {
            return;
        }

        processingRef.current = true;

        setIsProcessing(true);
        setError('');

        try {

            // Keep the same checkout reference
            // when retrying an interrupted payment
            let checkoutId =
                localStorage.getItem(CHECKOUT_KEY);

            if (!checkoutId) {

                checkoutId = crypto.randomUUID();

                localStorage.setItem(
                    CHECKOUT_KEY,
                    checkoutId
                );
            }

            setHasAttempt(true);

            // No client-controlled payment amount
            const response = await axios.post(
                `${API_BASE_URL}/payment`,
                {
                    checkoutId,
                    deliveryDetails,
                    cart
                }
            );

            const {
                success,
                clientSecret,
                status,
                amount: serverAmount
            } = response.data;

            if (
                !success ||
                !clientSecret ||
                serverAmount !== amount
            ) {
                throw new Error(
                    'Payment amount validation failed'
                );
            }

            // Do not charge an already paid order
            if (status === 'succeeded') {

                await verifyPayment(checkoutId);
                return;
            }

            // Do not submit another payment
            // while Stripe is still processing
            if (status === 'processing') {

                throw new Error(
                    'Payment is still processing. Please check again shortly.'
                );
            }

            if (status === 'canceled') {

                throw new Error(
                    'This payment was cancelled and requires review.'
                );
            }

            let result;

            // Resume interrupted authentication
            if (status === 'requires_action') {

                result = await stripe.confirmCardPayment(
                    clientSecret
                );

            } else {

                if (
                    status !== 'requires_payment_method' &&
                    status !== 'requires_confirmation'
                ) {
                    throw new Error(
                        'Unexpected payment status'
                    );
                }

                const cardElement =
                    elements.getElement(
                        CardNumberElement
                    );

                if (!cardElement) {
                    throw new Error(
                        'Card details not found'
                    );
                }

                // Stripe automatically handles
                // additional card authentication
                result = await stripe.confirmCardPayment(
                    clientSecret,
                    {
                        payment_method: {
                            card: cardElement,
                            billing_details: {
                                name:
                                    `${deliveryDetails.firstName} ${deliveryDetails.lastName}`,
                                email:
                                    deliveryDetails.email
                            }
                        }
                    }
                );
            }

            if (result.error) {

                throw new Error(
                    result.error.message
                );
            }

            if (
                result.paymentIntent?.status ===
                'succeeded'
            ) {

                await verifyPayment(checkoutId);

            } else {

                throw new Error(
                    'Payment has not yet been confirmed. Please check again before making another payment.'
                );
            }

        } catch (err) {

            setError(
                err.response?.data?.error ||
                err.message ||
                'Payment processing error'
            );

        } finally {

            processingRef.current = false;
            setIsProcessing(false);
        }
    };

    // Prevent address changes once payment has started
    const handleChangeAddress = () => {

        if (loading || isProcessing || hasAttempt) {
            return;
        }

        localStorage.removeItem('deliveryDetails');

        navigate('/checkout');
    };

    const paymentDisabled =
        loading ||
        isProcessing ||
        !stripe ||
        !elements ||
        !deliveryDetails ||
        !Number.isSafeInteger(amount) ||
        amount <= 0;

    return (

        <div className="payment-page-container">

            <div className="billing-address">

                <h2>1. Billing Address</h2>

                <div className="address-container">

                    {deliveryDetails ? (

                        <>

                            <div className="address-details">

                                <pre>
                                    {deliveryDetails.address}
                                </pre>

                            </div>

                            <button
                                type="button"
                                onClick={handleChangeAddress}
                                className="change-button"
                                disabled={
                                    loading ||
                                    isProcessing ||
                                    hasAttempt
                                }
                            >
                                Change
                            </button>

                        </>

                    ) : (

                        <p>
                            Billing address not found.
                        </p>

                    )}

                </div>

            </div>

            <div className="payment-form">

                <h2>2. Payment Details</h2>

                {loading && hasAttempt && (

                    <p
                        role="status"
                        style={{
                            fontSize: "14px",
                            color: "#555"
                        }}
                    >
                        Checking your previous payment.
                        Please do not submit another payment.
                    </p>

                )}

                <form onSubmit={handlePayment}>

                    <div className="input-field">

                        <label>Card Number</label>

                        <CardNumberElement
                            className="StripeElement"
                            options={{
                                placeholder:
                                    "1234 5678 9012 3456"
                            }}
                        />

                    </div>

                    <div className="expiry-cvv-field">

                        <div className="input-field half-width">

                            <label>Expiry MM/YY</label>

                            <CardExpiryElement
                                className="StripeElement"
                                options={{
                                    placeholder: "MM/YY"
                                }}
                            />

                        </div>

                        <div className="input-field half-width">

                            <label>CVV</label>

                            <CardCvcElement
                                className="StripeElement"
                                options={{
                                    placeholder: "3 digits"
                                }}
                            />

                        </div>

                    </div>

                    {error && (

                        <p
                            role="alert"
                            style={{
                                color: "#b91c1c",
                                fontSize: "14px"
                            }}
                        >
                            {error}
                        </p>

                    )}

                    <button
                        type="submit"
                        disabled={paymentDisabled}
                    >

                        {isProcessing
                            ? 'Processing…'
                            : loading
                                ? hasAttempt
                                    ? 'Checking payment…'
                                    : 'Checking price…'
                                : Number.isSafeInteger(amount)
                                    ? `Pay £${(amount / 100).toFixed(2)}`
                                    : 'Payment unavailable'
                        }

                    </button>

                </form>

                {process.env.NODE_ENV === 'development' && (

                    <p style={{
                        fontSize: "12px",
                        color: "#666"
                    }}>
                        Development test payments only.
                    </p>

                )}

            </div>

        </div>

    );
}

export default PaymentPage;
