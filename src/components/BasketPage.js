
// BasketPage.js
import React, { useContext } from 'react';
import { CartContext } from './CartContext';
import './BasketPage.css';

function BasketPage() {
    const { cart, addToCart, removeFromCart } = useContext(CartContext);

    const calculateTotal = () => {
        return cart.reduce((total, item) => total + item.price * item.quantity, 0).toFixed(2);
    };

    const expectedDeliveryDate = new Date();
    expectedDeliveryDate.setDate(expectedDeliveryDate.getDate() + 7); // Assuming 7 days delivery

    const handleCheckout = () => {
        console.log("Proceed to checkout");
        // Placeholder for checkout functionality
        // Here you would typically navigate to a checkout page or payment gateway
    };

    return (
        <div className="basket-page">
            <h1>Your Basket</h1>
            {cart.length === 0 ? (
                <p>Your basket is empty.</p>
            ) : (
                cart.map((item, index) => (
                    <div key={index}>
                        <p>{item.title} - £{item.price} x {item.quantity}</p>
                        <button onClick={() => addToCart(item)}>Add More</button>
                        <button onClick={() => removeFromCart(item.title)}>Remove</button>
                    </div>
                ))
            )}
            <p>Total Price: £{calculateTotal()}</p>
            <p>Expected Delivery Date: {expectedDeliveryDate.toDateString()}</p>
            <button className="checkout-button" onClick={handleCheckout}>Checkout Securely</button>
        </div>
    );
}

export default BasketPage;

