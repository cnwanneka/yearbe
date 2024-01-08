
import React, { useContext } from 'react';
import { CartContext } from './CartContext';
import './CartPage.css'; 

function CartPage() {
    const { cart, removeFromCart } = useContext(CartContext);

    return (
        <div className="cart-page">
            <h2>Your Shopping Cart</h2>
            {cart.length === 0 ? (
                <p>Your cart is empty.</p>
            ) : (
                cart.map((item, index) => (
                    <div key={index} className="cart-item">
                        <div className="item-details">
                            <p>{item.title} - £{item.price} x {item.quantity}</p>
                        </div>
                        <button className="remove-button" onClick={() => removeFromCart(item.title)}>Remove</button>
                    </div>
                ))
            )}
        </div>
    );
}

export default CartPage;

