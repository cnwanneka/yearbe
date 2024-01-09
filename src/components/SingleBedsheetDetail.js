
import React from 'react';
import SingleBedsheetImage from '../images/single-bedsheet.jpg'; // Import the image

function SingleBedsheetDetail() {
  return (
    <div>
      <h1>White Fitted Single Bedsheet</h1>
      <img src={SingleBedsheetImage} alt="Single Bedsheet" />
      <p>Price: £7.99</p>
      <p>Description: Comfortable single bedsheet, ideal for everyday use.</p>
      {/* Add more detailed information here */}
    </div>
  );
}

export default SingleBedsheetDetail;

