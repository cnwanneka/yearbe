
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

      <details className="return-policy">
        <summary><strong>Return Policy – Shop with Confidence</strong></summary>
        <div>
          <p>
            At <strong>Yearbe Ltd.</strong>, your satisfaction is our priority. If you’re not completely happy with your purchase,
            you can request a return within <strong>14 days</strong> of receiving your order.
          </p>
          <ul>
            <li>Items must be <strong>unused, unwashed</strong>, and in their original packaging with all tags intact.</li>
            <li>Proof of purchase is required.</li>
            <li>For hygiene reasons, we cannot accept returns of opened bedding unless defective or damaged.</li>
          </ul>
          <p>
            If your item arrives damaged or faulty, contact us within <strong>48 hours</strong> with photos, and we’ll arrange a
            replacement or full refund at no extra cost.
          </p>
          <p>
            For change-of-mind returns, customers cover return shipping. Refunds are processed within <strong>5–7 business days</strong> after inspection.
          </p>
          <p>
            Email us at <a href="mailto:support@yearbe.com">support@yearbe.com</a> for assistance.
          </p>

          {/* Removed the bottom link to the full policy */}
        </div>
      </details>
    </footer>
  );
}

export default Footer;
