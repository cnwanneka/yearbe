
import React from 'react';
import './Home.css';  
import Product from './Product';
import DoubleBedsheetImage from '../images/double-bedsheet.jpg'; // Import the image

function Home() {
  return (
    <div className="home-container">
      <h1>Welcome to Yearbe</h1>
      <div className="products-container">
        <Product 
          title="White Fitted Double Bedsheet" 
          price="9.99" 
          description="High-quality double bedsheet" 
          imageUrl={DoubleBedsheetImage} // Use the imported image here
        />
        {/* ... other products ... */}
      </div>
    </div>
  );
}

export default Home;

