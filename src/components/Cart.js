
import React, { useContext } from 'react';
import { CartContext } from './CartContext';

function Cart() {
    const { cart, removeFromCart } = useContext(CartContext);

    return (
        <div>
            <h2>Your Shopping Cart</h2>
            {cart.length === 0 && <p>Your cart is empty.</p>}
            {cart.map((item, index) => (
                <div key={index}>
                    <p>{item.title} - £{item.price} x {item.quantity}</p>
                    <button onClick={() => removeFromCart(item.title)}>Remove</button>
                </div>
            ))}
        </div>
    );
}

export default Cart;

