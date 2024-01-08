
import React from 'react';
import { Link } from 'react-router-dom';
import './Navbar.css';
import { HiOutlineShoppingBag } from 'react-icons/hi';

function Navbar() {
  
  return (
    <nav>
      <ul>
        <li><Link to="/">Home</Link></li>
        <li><Link to="/about">About</Link></li>
        <li><Link to="/contact">Contact</Link></li>
        <li className="shopping-cart-icon">
          <Link to="/cart"><HiOutlineShoppingBag /></Link>
        </li>    
      </ul>
    </nav>
  );
}

export default Navbar;

