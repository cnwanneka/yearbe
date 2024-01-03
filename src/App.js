import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home'; // Your Home component
import About from './components/About'; // Your About component
import Contact from './components/Contact'; // Your Contact component
import './App.css';
import Header from './components/Header';
import Product from './components/Product';
import Footer from './components/Footer';

function App() {
  return (
    <Router>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
      </Routes>
    </Router>
  );
}

export default App;
