
import React from 'react';
// Import CSS file if you have one, e.g., import './Footer.css';

function Footer() {
  return (
    <footer className="footer">
      <p>&copy; {(new Date().getFullYear())} Yearbe. All rights reserved.</p>
      {/* You can add more content here such as links or social media icons */}
    </footer>
  );
}

export default Footer;
