
import React, {
  useContext,
  useState,
  useEffect,
  useRef
} from "react";

import { CartContext } from "./CartContext";
import { useNavigate } from "react-router-dom";
import CJPreviewCheckoutSession from "./CJPreviewCheckoutSession";
import "./BasketPage.css";

const MAX_CJ_ITEMS = 5;

const COUNTRY_NAMES = {
  GB: "United Kingdom",
  US: "United States",
  CA: "Canada",
  AU: "Australia",
  DE: "Germany",
  FR: "France",
  NG: "Nigeria",
  IN: "India",
  ZA: "South Africa"
};

function formatGBP(value) {
  return `£${Number(value).toFixed(2)}`;
}

function formatTransit(value) {

  if (!value) {
    return "Unavailable";
  }

  const text = String(value);

  return /^\d+\s*-\s*\d+$/.test(text)
    ? `${text} days`
    : text;
}


// Separate CJ development preview basket
function CJPreviewBasket({
  cjPreviewCart,
  removeCJPreviewFromCart
}) {

  const [postcode, setPostcode] = useState("");
  const [loading, setLoading] = useState(false);
  const [validation, setValidation] = useState(null);

  const controllerRef = useRef(null);

  // Cancel pending validation when leaving the page
  useEffect(() => {
    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
        controllerRef.current = null;
      }
    };
  }, []);

  const destinations = [
    ...new Set(
      cjPreviewCart.map(item => item.destination)
    )
  ];

  const destination =
    destinations.length === 1
      ? destinations[0]
      : "";

  const variantIds = cjPreviewCart.map(
    item => Number(item.variantId)
  );

  const duplicateVariants =
    new Set(variantIds).size !== variantIds.length;

  const estimatedTotalPence = cjPreviewCart.reduce(
    (total, item) =>
      total + Math.round(Number(item.priceGBP) * 100),
    0
  );

  const estimatedTotal =
    estimatedTotalPence / 100;

  let basketIssue = "";

  if (cjPreviewCart.length > MAX_CJ_ITEMS) {
    basketIssue =
      `A maximum of ${MAX_CJ_ITEMS} CJ basket lines ` +
      "can be validated at once.";
  } else if (destinations.length !== 1) {
    basketIssue =
      "All CJ products must have the same delivery country.";
  } else if (!COUNTRY_NAMES[destination]) {
    basketIssue = "Invalid delivery country.";
  } else if (duplicateVariants) {
    basketIssue =
      "Duplicate product options detected. Remove the " +
      "duplicates and add the required combined quantity.";
  }

  // Only display results for the current basket
  // and current delivery postcode
  const currentValidation =
    validation?.cart === cjPreviewCart &&
    validation?.postcode === postcode
      ? validation
      : null;

  const validatedResult =
    currentValidation?.result || null;

  const priceChanged =
    validatedResult &&
    Math.round(
      Number(validatedResult.totalGBP) * 100
    ) !== estimatedTotalPence;


  // Remove a CJ item and invalidate previous results
  function handleRemove(cartKey) {

    setValidation(null);

    removeCJPreviewFromCart(cartKey);
  }


  // Validate the CJ basket with the backend
  async function validateBasket() {

    if (
      process.env.NODE_ENV !== "development" ||
      controllerRef.current ||
      loading ||
      basketIssue ||
      cjPreviewCart.length === 0
    ) {
      return;
    }

    setValidation(null);

    const cleanedPostcode = postcode.trim();

    const saveError = message =>
      setValidation({
        cart: cjPreviewCart,
        postcode,
        error: message
      });

    if (
      destination === "GB" &&
      !cleanedPostcode
    ) {
      saveError("Please enter your UK delivery postcode.");
      return;
    }

    if (
      cleanedPostcode.length > 20 ||
      !/^[A-Za-z0-9 -]*$/.test(cleanedPostcode)
    ) {
      saveError("Please enter a valid delivery postcode.");
      return;
    }

    const items = cjPreviewCart.map(item => ({
      variantId: Number(item.variantId),
      quantity: Number(item.quantity),
      shippingMethod: item.shippingMethod
    }));

    const controller = new AbortController();

    controllerRef.current = controller;

    const timeout = setTimeout(
      () => controller.abort(),
      90000
    );

    try {

      setLoading(true);

      const response = await fetch(
        "http://localhost:3001/api/cj/validate-checkout",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify({
            items,
            destination,
            postcode: cleanedPostcode
          }),

          signal: controller.signal
        }
      );

      const data = await response.json();

      if (controller.signal.aborted) {
        throw new Error("Validation cancelled");
      }

      if (
        !response.ok ||
        data.success !== true ||
        data.validated !== true
      ) {
        throw new Error(
          data.error || "Unable to validate basket"
        );
      }

      // Ensure this endpoint remains preview only
      if (
        data.previewOnly !== true ||
        data.paymentAllowed !== false ||
        data.currency !== "GBP" ||
        data.destination !== destination ||
        !Array.isArray(data.items) ||
        data.items.length !== items.length ||
        !Number.isFinite(Number(data.totalGBP)) ||
        Number(data.totalGBP) <= 0
      ) {
        throw new Error(
          "Invalid checkout validation response"
        );
      }

      // Store validation separately from the cart
      setValidation({
        cart: cjPreviewCart,
        postcode,
        result: data
      });

    } catch (error) {

      // Avoid updating an unmounted component
      if (controllerRef.current !== controller) {
        return;
      }

      saveError(
        controller.signal.aborted
          ? "Validation timed out. Please try again."
          : error.message
      );

    } finally {

      clearTimeout(timeout);

      if (controllerRef.current === controller) {

        controllerRef.current = null;

        setLoading(false);
      }
    }
  }


  return (

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
        They are excluded from the existing
        Yearbe checkout.
      </p>


      {/* Display CJ basket products */}

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
            Destination:{" "}
            {COUNTRY_NAMES[item.destination] ||
              item.destination}
          </p>

          <p>
            Shipping: {item.shippingMethod}
          </p>

          <p>
            Estimated transit:{" "}
            {formatTransit(item.transitTime)}
          </p>

          <p>
            <strong>
              Estimated total including delivery:{" "}
              {formatGBP(item.priceGBP)}
            </strong>
          </p>

          <button
            type="button"
            disabled={loading}
            onClick={() =>
              handleRemove(item.cartKey)
            }
          >
            Remove
          </button>

        </div>

      ))}


      {/* Estimated CJ basket total */}

      <h3>
        Estimated Basket Total:{" "}
        {formatGBP(estimatedTotal)}
      </h3>

      <p>
        Prices are indicative and subject
        to final validation.
      </p>


      {/* Delivery details */}

      <div
        style={{
          marginTop: "25px",
          padding: "18px",
          backgroundColor: "#f5f8fa",
          border: "1px solid #ddd",
          borderRadius: "8px"
        }}
      >

        <h3>Delivery Details</h3>

        <p>
          <strong>Delivery country:</strong>{" "}
          {COUNTRY_NAMES[destination] ||
            "Multiple or invalid destinations"}
        </p>

        <label
          htmlFor="cj-basket-postcode"
          style={{
            display: "block",
            marginBottom: "8px",
            fontWeight: "bold"
          }}
        >
          Delivery postcode
          {destination === "GB"
            ? " (required)"
            : " (if applicable)"}
        </label>

        <input
          id="cj-basket-postcode"
          type="text"
          autoComplete="postal-code"
          placeholder={
            destination === "GB"
              ? "Enter postcode, e.g. SW1A 1AA"
              : "Enter postal code"
          }
          value={postcode}
          maxLength={20}
          disabled={loading}
          onChange={event => {

            setValidation(null);

            setPostcode(
              event.target.value.toUpperCase()
            );
          }}
          style={{
            width: "100%",
            maxWidth: "400px",
            boxSizing: "border-box",
            padding: "12px",
            border: "1px solid #ccc",
            borderRadius: "5px",
            fontSize: "15px"
          }}
        />

        {basketIssue && (
          <p
            role="alert"
            style={{
              color: "#b00020"
            }}
          >
            {basketIssue}
          </p>
        )}

        <div style={{ marginTop: "20px" }}>

          <button
            type="button"
            disabled={loading || Boolean(basketIssue)}
            onClick={validateBasket}
            style={{
              backgroundColor:
                loading || basketIssue
                  ? "#ddd"
                  : "#87CEEB",
              color: "#000",
              padding: "12px 24px",
              border: "none",
              borderRadius: "5px",
              fontWeight: "bold",
              cursor:
                loading || basketIssue
                  ? "not-allowed"
                  : "pointer"
            }}
          >
            {loading
              ? "Validating Basket..."
              : "Validate Basket"}
          </button>

        </div>

        {loading && (
          <p role="status">
            Checking live product availability,
            supplier prices, inventory and delivery.
          </p>
        )}

      </div>


      {/* Validation error */}

      {currentValidation?.error && (

        <div
          role="alert"
          style={{
            marginTop: "20px",
            backgroundColor: "#fdecea",
            color: "#a12622",
            padding: "15px",
            borderRadius: "6px"
          }}
        >
          <strong>Basket validation unsuccessful</strong>

          <p>{currentValidation.error}</p>
        </div>

      )}


      {/* Successful validation */}

      {validatedResult && (

        <div
          aria-live="polite"
          style={{
            marginTop: "25px",
            padding: "20px",
            border: "1px solid #cbdde5",
            backgroundColor: "#f2f7fa",
            borderRadius: "8px"
          }}
        >

          <h2>
            {validatedResult.conditional
              ? "Conditional Validation Passed"
              : "Basket Validation Passed"}
          </h2>

          <p>
            Product, stock, supplier price and
            shipping checks have been completed.
            This does not reserve inventory.
          </p>

          {validatedResult.items.map(item => (

            <div
              key={item.variantId}
              style={{
                padding: "15px 0",
                borderBottom: "1px solid #ddd"
              }}
            >

              <h3>{item.title}</h3>

              <p>
                <strong>Quantity:</strong>{" "}
                {item.quantity}
              </p>

              <p>
                <strong>Stock source:</strong>{" "}
                {item.stockSource === "cj_warehouse"
                  ? "CJ warehouse"
                  : item.stockSource === "factory"
                    ? "Supplier factory"
                    : "Unknown"}
              </p>

              <p>
                <strong>Inventory verification:</strong>{" "}
                {item.inventoryVerified
                  ? "Verified"
                  : "Awaiting verification"}
              </p>

              <p>
                <strong>Supplier procurement:</strong>{" "}
                {item.requiresProcurement
                  ? "Required"
                  : "Not required"}
              </p>

              <p>
                <strong>Shipping:</strong>{" "}
                {item.shippingMethod}
              </p>

              <p>
                <strong>Estimated processing:</strong>{" "}
                {item.processingTimeDays
                  ? `${item.processingTimeDays.min}–${item.processingTimeDays.max} days`
                  : "Unavailable"}
              </p>

              <p>
                <strong>Estimated transit:</strong>{" "}
                {formatTransit(item.transitTime)}
              </p>

              {item.procurementWarning && (

                <p
                  style={{
                    backgroundColor: "#fff3cd",
                    padding: "12px",
                    borderRadius: "5px"
                  }}
                >
                  {item.procurementWarning}
                </p>

              )}

              <p>
                <strong>
                  Validated item total:{" "}
                  {formatGBP(item.totalGBP)}
                </strong>
              </p>

            </div>

          ))}


          {/* Warn when the latest price is different */}

          {priceChanged && (

            <p
              style={{
                backgroundColor: "#fff3cd",
                padding: "12px",
                borderRadius: "5px"
              }}
            >
              The latest validated price differs
              from your original estimate.
              Please review the updated total.
            </p>

          )}

          <h2>
            Validated Basket Total:{" "}
            {formatGBP(validatedResult.totalGBP)}
          </h2>

          <p>
            <small>
              Includes quoted delivery.
              Additional applicable retail taxes
              are not yet included.
            </small>
          </p>

          {validatedResult.validatedAt && (

            <p>
              <small>
                Last validated:{" "}
                {new Date(
                  validatedResult.validatedAt
                ).toLocaleString("en-GB")}
              </small>
            </p>

          )}

          <p>
            Payment is disabled during development.
            No order has been placed.
          </p>

        </div>

      )}


      {/* CJ payment remains disabled */}

      <button
        type="button"
        disabled
        style={{
          marginTop: "25px",
          padding: "12px 24px",
          backgroundColor: "#ddd",
          color: "#777",
          border: "none",
          borderRadius: "5px",
          cursor: "not-allowed"
        }}
      >
        CJ Payments Coming Soon
      </button>

      {/* Secure CJ development checkout sessions */}

      {validatedResult && !basketIssue && !loading && (
        <CJPreviewCheckoutSession
          key={JSON.stringify({
            destination,
            postcode: postcode.trim(),
            validatedAt: validatedResult.validatedAt,
            items: cjPreviewCart.map(item => ({
              variantId: item.variantId,
              quantity: item.quantity,
              shippingMethod: item.shippingMethod
            }))
          })}
          cjPreviewCart={cjPreviewCart}
          destination={destination}
          postcode={postcode}
          initialValidatedTotalGBP={
            validatedResult.totalGBP
          }
        />
      )}

    </section>

  );
}


// Main Yearbe basket
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


  // Existing Yearbe product total only
  const calculateTotal = () => {

    return cart.reduce(
      (total, item) =>
        total + item.price * item.quantity,
      0
    ).toFixed(2);
  };


  // Existing Yearbe delivery estimate
  const expectedDeliveryDate = new Date();

  expectedDeliveryDate.setDate(
    expectedDeliveryDate.getDate() + 7
  );


  // Existing Yearbe checkout
  const handleCheckout = () => {

    if (cart.length === 0) {
      return;
    }

    // CJ preview products remain excluded
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
        (!isDevelopment ||
          cjPreviewCart.length === 0) && (

          <p>Your basket is empty.</p>

        )}


      {/* Existing Yearbe products */}

      {cart.length > 0 && (

        <section>

          <h2>Yearbe Products</h2>

          {cart.map(item => (

            <div key={item.title}>

              <p>
                {item.title} -{" "}
                {formatGBP(item.price)} x {item.quantity}
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


      {/* CJ development preview */}

      {isDevelopment &&
        cjPreviewCart.length > 0 && (

          <CJPreviewBasket
            cjPreviewCart={cjPreviewCart}
            removeCJPreviewFromCart={
              removeCJPreviewFromCart
            }
          />

        )}

    </div>

  );
}

export default BasketPage;