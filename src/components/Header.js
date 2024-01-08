
import React from 'react';
import { Link } from 'react-router-dom'; // Import Link component
import Navbar from './Navbar';
import './Header.css';

function Header() {
  return (
    <header>
      <div className="logo">
        {/* Add Link to wrap around "Yearbe" */}
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          Yearbe
        </Link>
      </div>
      <Navbar />
      {/* You can add more elements here */}
    </header>
  );
}

export default Header;
