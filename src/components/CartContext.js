

import React, {
  createContext,
  useState,
  useEffect,
  useCallback
} from "react";

export const CartContext = createContext();

const CJ_PREVIEW_STORAGE_KEY =
  "yearbe_cj_preview_cart_v1";

// Restore CJ products after a browser refresh.
// Saved prices are estimates, never trusted
// for checkout or payment.
function loadCJPreviewCart() {

  if (
    process.env.NODE_ENV !== "development" ||
    typeof window === "undefined"
  ) {
    return [];
  }

  try {

    const saved = localStorage.getItem(
      CJ_PREVIEW_STORAGE_KEY
    );

    if (!saved) {
      return [];
    }

    const items = JSON.parse(saved);

    if (!Array.isArray(items)) {
      return [];
    }

    const seen = new Set();

    return items
      .filter(item => {

        if (!item || typeof item !== "object") {
          return false;
        }

        const quantity = Number(item.quantity);
        const variantId = Number(item.variantId);
        const priceGBP = Number(item.priceGBP);

        return (
          Boolean(item.productId) &&
          Number.isSafeInteger(variantId) &&
          variantId > 0 &&
          typeof item.title === "string" &&
          item.title.trim().length > 0 &&
          typeof item.destination === "string" &&
          /^[A-Z]{2}$/.test(item.destination) &&
          typeof item.shippingMethod === "string" &&
          item.shippingMethod.length > 0 &&
          Number.isInteger(quantity) &&
          quantity >= 1 &&
          quantity <= 20 &&
          Number.isFinite(priceGBP) &&
          priceGBP > 0
        );

      })
      .map(item => {

        const cartKey = JSON.stringify([
          String(item.productId),
          String(item.variantId),
          item.destination,
          item.shippingMethod
        ]);

        return {
          productId: item.productId,
          variantId: Number(item.variantId),
          title: item.title,
          variantKey: item.variantKey || "",
          imageUrl: item.imageUrl || "",
          destination: item.destination,
          shippingMethod: item.shippingMethod,
          transitTime: item.transitTime || "",
          quantity: Number(item.quantity),
          priceGBP: Number(item.priceGBP),
          cartKey,
          source: "cj",
          previewOnly: true
        };

      })
      .filter(item => {

        if (seen.has(item.cartKey)) {
          return false;
        }

        seen.add(item.cartKey);
        return true;

      });

  } catch (error) {

    console.warn(
      "Unable to restore CJ preview basket:",
      error.message
    );

    return [];
  }
}

export const CartProvider = ({ children }) => {

  // Existing Yearbe products
  const [cart, setCart] = useState([]);

  // Restore CJ preview products from browser storage
  const [cjPreviewCart, setCJPreviewCart] =
    useState(loadCJPreviewCart);

  const isDevelopment =
    process.env.NODE_ENV === "development";

  // Save CJ preview products whenever they change.
  // Never save checkout tokens or validation results.
  useEffect(() => {

    if (!isDevelopment) {
      return;
    }

    try {

      localStorage.setItem(
        CJ_PREVIEW_STORAGE_KEY,
        JSON.stringify(cjPreviewCart)
      );

    } catch (error) {

      console.warn(
        "Unable to save CJ preview basket:",
        error.message
      );

    }

  }, [cjPreviewCart, isDevelopment]);


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


  // Clear Yearbe bedsheet basket after
  // successful and verified payment
  const clearBedsheetCart = useCallback(() => {

    setCart([]);

    localStorage.removeItem("cart");

    localStorage.removeItem("totalAmount");

    // CJ preview basket is deliberately untouched.

  }, []);


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
        clearBedsheetCart,
        cjPreviewCart,
        addCJPreviewToCart,
        removeCJPreviewFromCart
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
