
import React from 'react';
import './Home.css'; 
import Product from './Product';

function Home() {
  return (
    <div className="home-container"> 
      <h1>Welcome to Yearbe</h1>
      <Product title="White Fitted Double Bedsheet" price="9.99" description="High-quality double bedsheet" />
      <Product title="White Fitted Single Bedsheet" price="7.99" description="Comfortable single bedsheet" />
    </div>
  );
}

export default Home;
