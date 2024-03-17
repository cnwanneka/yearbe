
import React from 'react';
import './Footer.css';

function Footer() {
  return (
    <footer className="footer">
      <p>&copy; {(new Date().getFullYear())} Yearbe. All rights reserved.</p>
      <p>Contact us at: <a href="mailto:cnwanneka@gmail.com">cnwanneka@gmail.com</a></p>
    </footer>
  );
}

export default Footer;
