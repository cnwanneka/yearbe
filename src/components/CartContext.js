

import React, { createContext, useState } from "react";

export const CartContext = createContext();

export const CartProvider = ({ children }) => {

  // Existing Yearbe products
  const [cart, setCart] = useState([]);

  // CJ products for development preview
  const [cjPreviewCart, setCJPreviewCart] = useState([]);

  const isDevelopment =
    process.env.NODE_ENV === "development";

  // Add existing Yearbe products
  const addToCart = (product) => {

    setCart(previousCart => {

      const existingProduct = previousCart.find(
        item => item.title === product.title
      );

      if (existingProduct) {
        return previousCart.map(item =>
          item.title === product.title
            ? {
                ...item,
                quantity: item.quantity + 1
              }
            : item
        );
      }

      return [
        ...previousCart,
        {
          ...product,
          quantity: 1
        }
      ];
    });
  };

  // Remove existing Yearbe products
  const removeFromCart = (productTitle) => {

    setCart(previousCart =>
      previousCart.filter(
        item => item.title !== productTitle
      )
    );
  };

  // Add CJ products to preview basket only
  const addCJPreviewToCart = (product) => {

    if (!isDevelopment || !product) {
      return false;
    }

    const quantity = Number(product.quantity);
    const priceGBP = Number(product.priceGBP);

    if (
      !product.productId ||
      !product.variantId ||
      !product.title ||
      !product.destination ||
      !product.shippingMethod ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 20 ||
      !Number.isFinite(priceGBP) ||
      priceGBP <= 0
    ) {
      return false;
    }

    const cartKey = JSON.stringify([
      String(product.productId),
      String(product.variantId),
      product.destination,
      product.shippingMethod
    ]);

    const previewItem = {
      ...product,
      cartKey,
      quantity,
      priceGBP,
      source: "cj",
      previewOnly: true
    };

    setCJPreviewCart(previousCart => {

      const existingProduct = previousCart.find(
        item => item.cartKey === cartKey
      );

      if (existingProduct) {

        // Replace with latest quoted quantity and price
        return previousCart.map(item =>
          item.cartKey === cartKey
            ? previewItem
            : item
        );
      }

      return [...previousCart, previewItem];
    });

    return true;
  };

  // Remove CJ preview product
  const removeCJPreviewFromCart = (cartKey) => {

    setCJPreviewCart(previousCart =>
      previousCart.filter(
        item => item.cartKey !== cartKey
      )
    );
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        cjPreviewCart,
        addCJPreviewToCart,
        removeCJPreviewFromCart
      }}
    >
      {children}
    </CartContext.Provider>
  );
};


