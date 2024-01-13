
// Navbar.js
import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { HiOutlineShoppingBag } from 'react-icons/hi';
import { CartContext } from './CartContext'; // Import CartContext
import './Navbar.css';

function Navbar() {
    const { cart } = useContext(CartContext);

    // Calculate the total number of items in the cart
    const totalItems = cart.reduce((total, item) => total + item.quantity, 0);

    return (
        <nav>
            <ul>
                <li><Link to="/">Home</Link></li>
                <li><Link to="/about">About</Link></li>
                <li><Link to="/contact">Contact</Link></li>
                <li className="shopping-cart-icon">
                    <Link to="/basket">
                        <HiOutlineShoppingBag />
                        {totalItems > 0 && <span className="cart-item-count">{totalItems}</span>}
                    </Link>
                </li>    
            </ul>
        </nav>
    );
}

export default Navbar;
