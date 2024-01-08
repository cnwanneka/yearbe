
import React, { useContext } from 'react';
import './Product.css';
import { CartContext } from './CartContext'; // Import CartContext

function Product({ title, price, description, imageUrl }) {
  const { addToCart } = useContext(CartContext);

  const handleAddToCart = () => {
    const product = { title, price, description, imageUrl };
    addToCart(product);
  };

  return (
    <div className="product-card">
      {imageUrl && <img src={imageUrl} alt={title} className="product-image" />}
      <h2>{title}</h2>
      <p>Price: £{price}</p>
      <p>{description}</p>
      <button onClick={handleAddToCart}>Add to Cart</button>
    </div>
  );
}

export default Product;
