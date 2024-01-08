
import React, { createContext, useState } from 'react';

export const CartContext = createContext();

export const CartProvider = ({ children }) => {
    const [cart, setCart] = useState([]);

    const addToCart = (product) => {
        const existingProduct = cart.find(item => item.title === product.title);
        if (existingProduct) {
            // Increment quantity
            setCart(cart.map(item => item.title === product.title ? { ...item, quantity: item.quantity + 1 } : item));
        } else {
            // Add new product
            setCart([...cart, { ...product, quantity: 1 }]);
        }
    };

    const removeFromCart = (productTitle) => {
        setCart(cart.filter(item => item.title !== productTitle));
    };

    return (
        <CartContext.Provider value={{ cart, addToCart, removeFromCart }}>
            {children}
        </CartContext.Provider>
    );
};

