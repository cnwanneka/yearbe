
import React, { useContext } from "react";
import { CartContext } from "./CartContext";
import { useNavigate } from "react-router-dom";
import "./BasketPage.css";

function BasketPage() {

  const {
    cart,
    addToCart,
    removeFromCart,
    cjPreviewCart,
    removeCJPreviewFromCart
  } = useContext(CartContext);

  const navigate = useNavigate();

  const isDevelopment =
    process.env.NODE_ENV === "development";

  // Calculate existing Yearbe product total only
  const calculateTotal = () => {

    return cart.reduce(
      (total, item) =>
        total + item.price * item.quantity,
      0
    ).toFixed(2);
  };

  // Delivery estimate for existing Yearbe products
  const expectedDeliveryDate = new Date();

  expectedDeliveryDate.setDate(
    expectedDeliveryDate.getDate() + 7
  );

  // Existing Yearbe checkout
  const handleCheckout = () => {

    if (cart.length === 0) {
      return;
    }

    // CJ preview products are excluded
    localStorage.setItem(
      "totalAmount",
      calculateTotal()
    );

    navigate("/checkout");
  };

  return (
    <div className="basket-page">

      <h1>Your Basket</h1>

      {cart.length === 0 &&
        cjPreviewCart.length === 0 && (
          <p>Your basket is empty.</p>
        )}

      {cart.length > 0 && (
        <section>

          <h2>Yearbe Products</h2>

          {cart.map(item => (
            <div key={item.title}>

              <p>
                {item.title} -
                £{item.price} x {item.quantity}
              </p>

              <button
                onClick={() => addToCart(item)}
              >
                Add More
              </button>

              <button
                onClick={() =>
                  removeFromCart(item.title)
                }
              >
                Remove
              </button>

            </div>
          ))}

          <p>
            <strong>
              Total Price: £{calculateTotal()}
            </strong>
          </p>

          <p>
            Expected Delivery Date:{" "}
            {expectedDeliveryDate.toDateString()}
          </p>

          <button
            className="checkout-button"
            onClick={handleCheckout}
          >
            Checkout Securely
          </button>

        </section>
      )}

      {isDevelopment &&
        cjPreviewCart.length > 0 && (

          <section
            style={{
              marginTop: "30px",
              padding: "20px",
              border: "1px solid #ddd",
              borderRadius: "8px"
            }}
          >

            <h2>CJ Product Preview</h2>

            <p
              style={{
                backgroundColor: "#fff3cd",
                padding: "12px",
                borderRadius: "5px"
              }}
            >
              Development preview — these products
              are not yet available for purchase.
              They are excluded from checkout.
            </p>

            {cjPreviewCart.map(item => (

              <div
                key={item.cartKey}
                style={{
                  borderBottom: "1px solid #ddd",
                  padding: "15px 0"
                }}
              >

                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    style={{
                      width: "100px",
                      borderRadius: "6px",
                      objectFit: "cover"
                    }}
                  />
                )}

                <h3>{item.title}</h3>

                <p>
                  Option: {item.variantKey}
                </p>

                <p>
                  Quantity: {item.quantity}
                </p>

                <p>
                  Destination: {item.destination}
                </p>

                <p>
                  Shipping: {item.shippingMethod}
                </p>

                <p>
                  Estimated transit:{" "}
                  {item.transitTime || "Unavailable"}
                </p>

                <p>
                  <strong>
                    Estimated total including delivery:
                    £{item.priceGBP.toFixed(2)}
                  </strong>
                </p>

                <button
                  onClick={() =>
                    removeCJPreviewFromCart(
                      item.cartKey
                    )
                  }
                >
                  Remove
                </button>

              </div>
            ))}

            <p>
              Prices are indicative and subject
              to final validation.
            </p>

            <button
              className="checkout-button"
              disabled
            >
              CJ Checkout Coming Soon
            </button>

          </section>
        )}

    </div>
  );
}

export default BasketPage;

