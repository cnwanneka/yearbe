
import React, { useContext } from 'react';
import { CartContext } from './CartContext';

function Cart() {
    const { cart } = useContext(CartContext);

    return (
        <div>
            <h2>Your Cart</h2>
            <ul>
                {cart.map((item, index) => (
                    <li key={index}>{item.title} - £{item.price}</li>
                ))}
            </ul>
        </div>
    );
}

export default Cart;
