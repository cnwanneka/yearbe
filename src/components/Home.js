
import React from 'react';
import './Home.css';  
import Product from './Product';
import DoubleBedsheetImage from '../images/double-bedsheet.jpg'; // Import the image
import SingleBedsheetImage from '../images/single-bedsheet.jpg'; // Import the image

function Home() {
  return (
    <div className="home-container">
      <h1>Welcome to Yearbe</h1>
      <div className="products-container">
        <Product 
          title="White Fitted Double Bedsheet" 
          price="9.99" 
          description="High-quality double bedsheet" 
          imageUrl={DoubleBedsheetImage} // imported image
        />
        <Product 
          title="White Fitted Single Bedsheet" 
          price="7.99" 
          description="Comfortable single bedsheet" 
          imageUrl={SingleBedsheetImage} // imported image 
        />
      </div>
    </div>
  );
}

export default Home;

