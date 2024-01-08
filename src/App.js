
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Home from './components/Home';
import About from './components/About';
import Contact from './components/Contact';
import Footer from './components/Footer';
import './App.css';
import Cart from './components/Cart';
import { CartProvider } from './components/CartContext';

function App() {
  return (
    <CartProvider>
      <Router>
        <div className="app-container">
          <Header />
          <Cart />
          <div className="content-wrap">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
            </Routes>
          </div>
          <Footer />
        </div>
      </Router>
    </CartProvider>

  );
}

export default App;
