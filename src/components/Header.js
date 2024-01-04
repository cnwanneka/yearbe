

import React from 'react';
import Navbar from './Navbar'; // Import Navbar component
import './Header.css';

function Header() {
  return (
    <header>
      <div className="logo">Yearbe</div>
      <Navbar />
      {/* You can add more elements here */}
    </header>
  );
}

export default Header;
