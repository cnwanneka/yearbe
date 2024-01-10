
import React from 'react';
import SingleBedsheetImage from '../images/single-bedsheet.jpg';
import './SingleBedsheetDetail.css';

function SingleBedsheetDetail() {
    return (
        <div className="single-bedsheet-detail">
            <h1>White Fitted Single Bedsheet - Perfect for Every Bedroom</h1>
            <img src={SingleBedsheetImage} alt="Elegant white fitted single bedsheet" />
            <h2>Product Features</h2>
            <p>Our white fitted single bedsheets blend elegance with functionality. Crafted from premium materials, they offer unmatched comfort, making them ideal for everyday use.</p>
        </div>
    );
}

export default SingleBedsheetDetail;

