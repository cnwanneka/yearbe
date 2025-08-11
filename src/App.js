
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Home from './components/Home';
import About from './components/About';
import Contact from './components/Contact';
import ReturnPolicy from './components/ReturnPolicy';
import Footer from './components/Footer';
import BasketPage from './components/BasketPage';
import CheckoutPage from './components/CheckoutPage';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import PaymentPage from './components/PaymentPage';
import PaymentSuccess from './components/PaymentSuccess';
import './App.css';
import { CartProvider } from './components/CartContext';
import SingleBedsheetDetail from './components/SingleBedsheetDetail';
import DoubleBedsheetDetail from './components/DoubleBedsheetDetail';

// Guard against missing Stripe key (prevents crash/blank screen)
const stripeKey = process.env.REACT_APP_STRIPE_KEY;
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

function App() {
  return (
    <CartProvider>
      <Router>
        <div className="app-container">
          <Header />
          <div className="content-wrap">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/double-bedsheet" element={<DoubleBedsheetDetail />} />
              <Route path="/single-bedsheet" element={<SingleBedsheetDetail />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />

              {/* Support both /returns and /returnpolicy */}
              <Route path="/returns" element={<ReturnPolicy />} />
              <Route path="/returnpolicy" element={<ReturnPolicy />} />

              <Route path="/basket" element={<BasketPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />

              <Route
                path="/payment"
                element={
                  stripePromise ? (
                    <Elements stripe={stripePromise}>
                      <PaymentPage />
                    </Elements>
                  ) : (
                    <div style={{ padding: 24 }}>
                      <h2>Payment temporarily unavailable</h2>
                      <p>
                        Stripe key not configured. Set <code>REACT_APP_STRIPE_KEY</code> in your <code>.env</code> and restart the dev server.
                      </p>
                    </div>
                  )
                }
              />

              <Route path="/confirmation" element={<PaymentSuccess />} />
            </Routes>
          </div>
          <Footer />
        </div>
      </Router>
    </CartProvider>
  );
}

export default App;
