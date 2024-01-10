
import React from 'react';
import SingleBedsheetImage from '../images/single-bedsheet.jpg';
import './SingleBedsheetDetail.css';

function SingleBedsheetDetail() {
    return (
        <div className="single-bedsheet-detail">
            <h2>White Fitted Single Bedsheet</h2>
            <img src={SingleBedsheetImage} alt="Single Bed Sheet" />
            <p>High-quality single bedsheet</p>
        </div>
    );
}

export default SingleBedsheetDetail;

