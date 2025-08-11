
// src/components/Footer.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

function Footer() {
  return (
    <footer className="footer">
      <p>&copy; {new Date().getFullYear()} Yearbe. All rights reserved.</p>
      <p>Contact us at: <a href="mailto:support@yearbe.com">support@yearbe.com</a></p>

      {/* Footer link to page */}
      <nav className="footer-links">
        <Link to="/returnpolicy">Returns & Refunds Policy</Link>
      </nav>

    </footer>
  );
}

export default Footer;
