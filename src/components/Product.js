
import React from 'react';
import './Product.css';  // Import the CSS file

function Product({ title, price, description }) {
  return (
    <div className="product-card">
      <h2>{title}</h2>
      <p>Price: £{price}</p>
      <p>{description}</p>
      <button>Add to Cart</button>
    </div>
  );
}

export default Product;

