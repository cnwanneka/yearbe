
import React from 'react';
import './Product.css';

function Product({ title, price, description }) {
  return (
    <div className="product">
      <h2>{title}</h2>
      <p>Price: £{price}</p>
      <p>{description}</p>
      <button>Add to Cart</button>
    </div>
  );
}

export default Product;
