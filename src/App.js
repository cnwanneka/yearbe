
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Home from './components/Home';
import About from './components/About';
import Contact from './components/Contact'; 
import Footer from './components/Footer';
import BasketPage from './components/BasketPage';
import CheckoutPage from './components/CheckoutPage';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import PaymentPage from './components/PaymentPage';
import ConfirmationPage from './components/ConfirmationPage';
import './App.css';
import { CartProvider } from './components/CartContext';
import SingleBedsheetDetail from './components/SingleBedsheetDetail';
import DoubleBedsheetDetail from './components/DoubleBedsheetDetail';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_KEY);

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
              <Route path="/basket" element={<BasketPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/payment" element={<Elements stripe={stripePromise}><PaymentPage /></Elements>} />
              <Route path="/confirmation" element={<ConfirmationPage />} />
            </Routes>
          </div>
          <Footer />
        </div>
      </Router>
    </CartProvider>

  );
}

export default App;
