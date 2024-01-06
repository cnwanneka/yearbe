
import React from 'react';
import './Product.css';  // Ensure CSS is imported

function Product({ title, price, description, imageUrl }) {
  return (
    <div className="product-card">
      {imageUrl && <img src={imageUrl} alt={title} className="product-image" />}
      <h2>{title}</h2>
      <p>Price: £{price}</p>
      <p>{description}</p>
      <button>Add to Cart</button>
    </div>
  );
}

export default Product;



