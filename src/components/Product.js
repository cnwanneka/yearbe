
import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import './Product.css';
import { CartContext } from './CartContext';

function Product({ title, price, description, imageUrl, detailPath }) {
    const { addToCart } = useContext(CartContext);

    const handleAddToCart = () => {
        const product = { title, price, description, imageUrl };
        addToCart(product);
    };

    return (
        <div className="product-card">
            <Link to={detailPath}>
                {imageUrl && <img src={imageUrl} alt={title} className="product-image" />}
            </Link>
            <h2>{title}</h2>
            <p>Price: £{price}</p>
            <p>{description}</p>
            <button onClick={handleAddToCart}>Add to Cart</button>
        </div>
    );
}

export default Product;


