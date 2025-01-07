
// Home.js
import React from 'react';
import './Home.css';  
import Product from './Product';
import DoubleBedsheetImage from '../images/double-bedsheet.jpg';
import SingleBedsheetImage from '../images/single-bedsheet.jpg';

function Home() {
    return (
        <div className="home-container">
            <h1>Welcome to Yearbe</h1>
            <div className="products-container">
                <Product 
                  title="White Fitted Double Bedsheet" 
                  price="5.99" 
                  description="High-quality double bedsheet" 
                  imageUrl={DoubleBedsheetImage}
                  detailPath="/double-bedsheet"
                />
                <Product 
                  title="White Fitted Single Bedsheet" 
                  price="4.99" 
                  description="Comfortable single bedsheet" 
                  imageUrl={SingleBedsheetImage}
                  detailPath="/single-bedsheet"
                />
            </div>
        </div>
    );
}

export default Home;
