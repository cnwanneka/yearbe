
import React from 'react';
import SingleBedsheetImage from '../images/single-bedsheet.jpg';
import './SingleBedsheetDetail.css';

function SingleBedsheetDetail() {
    return (
        <div className="single-bedsheet-detail">
            <h1>White Fitted Single Bedsheet - Perfect for Every Bedroom</h1>
            <img src={SingleBedsheetImage} alt="Elegant white fitted single bedsheet" />
            <h2>Product Features</h2>
            <p>Our white fitted single bedsheets seamlessly combine elegance with practicality. Meticulously crafted from premium materials, these sheets provide exceptional comfort and durability, making them the perfect choice for everyday use. Their sleek design and superior quality ensure your bed not only looks great but feels incredibly soft night after night.</p>
        </div>
    );
}

export default SingleBedsheetDetail;

