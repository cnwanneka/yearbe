
import React, {
  useState,
  useEffect,
  useContext,
  useRef
} from "react";

import { Link } from "react-router-dom";
import { CartContext } from "./CartContext";

const countries = [
  ["GB", "United Kingdom"],
  ["US", "United States"],
  ["CA", "Canada"],
  ["AU", "Australia"],
  ["DE", "Germany"],
  ["FR", "France"],
  ["NG", "Nigeria"],
  ["IN", "India"],
  ["ZA", "South Africa"]
];

const currencies = [
  "GBP", "USD", "EUR", "CAD",
  "AUD", "NGN", "INR", "ZAR"
];

function CJQuotePreview({
  product,
  selectedVariant,
  variantId,
  quantity
}) {

  const [destination, setDestination] =
    useState("GB");

  const [currency, setCurrency] =
    useState("GBP");

  const requestKey = JSON.stringify([
    variantId,
    quantity,
    destination,
    currency
  ]);

  return (
    <div className="cj-quote-container">

      <label htmlFor="cj-destination">
        Delivery country
      </label>

      <select
        id="cj-destination"
        value={destination}
        onChange={event =>
          setDestination(event.target.value)
        }
      >
        {countries.map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>

      <label htmlFor="cj-currency">
        Display currency
      </label>

      <select
        id="cj-currency"
        value={currency}
        onChange={event =>
          setCurrency(event.target.value)
        }
      >
        {currencies.map(code => (
          <option key={code} value={code}>
            {code}
          </option>
        ))}
      </select>

      {/* Reset quote when any selection changes */}
      <CJQuoteResult
        key={requestKey}
        product={product}
        selectedVariant={selectedVariant}
        variantId={variantId}
        quantity={quantity}
        destination={destination}
        currency={currency}
      />

    </div>
  );
}

function CJQuoteResult({
  product,
  selectedVariant,
  variantId,
  quantity,
  destination,
  currency
}) {

  const { addCJPreviewToCart } =
    useContext(CartContext);

  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [basketMessage, setBasketMessage] =
    useState("");

  const [added, setAdded] = useState(false);

  const controllerRef = useRef(null);

  const isDevelopment =
    process.env.NODE_ENV === "development";

  // Cancel obsolete requests when selections change
  useEffect(() => {
    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
        controllerRef.current = null;
      }
    };
  }, []);

  async function calculatePrice() {

    if (controllerRef.current || !variantId) {
      return;
    }

    const controller = new AbortController();

    controllerRef.current = controller;

    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 30000);

    try {
      setLoading(true);
      setQuote(null);
      setError("");
      setBasketMessage("");
      setAdded(false);

      const response = await fetch(
        "http://localhost:3001/api/cj/quote",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            variantId,
            quantity,
            destination,
            currency
          }),
          signal: controller.signal
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Unable to calculate price"
        );
      }

      const priceGBP = Number(data.priceGBP);

      // Validate the returned quotation
      if (
        Number(data.quantity) !== quantity ||
        !["number", "string"].includes(
          typeof data.priceGBP
        ) ||
        !Number.isFinite(priceGBP) ||
        priceGBP <= 0 ||
        typeof data.shippingMethod !== "string" ||
        !data.shippingMethod.trim()
      ) {
        throw new Error("Invalid price quotation");
      }

      if (
        controllerRef.current !== controller ||
        controller.signal.aborted
      ) {
        return;
      }

      setQuote(data);

    } catch (err) {

      if (controllerRef.current !== controller) {
        return;
      }

      if (timedOut) {
        setError(
          "Price calculation timed out. Please try again."
        );
      } else if (!controller.signal.aborted) {
        setError(err.message);
      }

    } finally {

      clearTimeout(timeout);

      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setLoading(false);
      }

    }
  }

  // Add the current quotation to the preview basket
  function handleAddToBasket() {

    setBasketMessage("");
    setAdded(false);

    if (
      !isDevelopment ||
      !quote ||
      loading ||
      !product ||
      !selectedVariant
    ) {
      return;
    }

    const success = addCJPreviewToCart({
      productId: product.id,

      variantId: selectedVariant.id,

      title: product.name,

      sku: selectedVariant.sku,

      variantKey:
        selectedVariant.variant_key ||
        selectedVariant.sku ||
        `Option ${selectedVariant.id}`,

      imageUrl:
        selectedVariant.variant_image_url ||
        product.image_url,

      quantity,

      destination,

      currency,

      displayPrice: quote.displayPrice,

      // Total for selected quantity including delivery
      priceGBP: Number(quote.priceGBP),

      shippingMethod: quote.shippingMethod,

      transitTime: quote.transitTime || null,

      quotedAt: new Date().toISOString()
    });

    if (success) {
      setAdded(true);

      setBasketMessage(
        "Product added to your preview basket."
      );
    } else {
      setBasketMessage(
        "Unable to add product. Please calculate the price again."
      );
    }
  }

  return (
    <>

      <button
        type="button"
        className="cj-calculate-button"
        disabled={loading || !variantId}
        onClick={calculatePrice}
      >
        {loading
          ? "Calculating..."
          : "Calculate Price & Delivery"}
      </button>

      {error && (
        <p className="cj-quote-error">
          {error}
        </p>
      )}

      {quote && (

        <div className="cj-quote-result">

          <p className="cj-quote-price">
            {quote.displayPrice}
          </p>

          <p>
            Estimated total for {quote.quantity} item(s),
            including delivery.
          </p>

          <p>
            <strong>Shipping:</strong>{" "}
            {quote.shippingMethod}
          </p>

          <p>
            <strong>Estimated transit:</strong>{" "}
            {quote.transitTime || "Unavailable"}
          </p>

          <p className="cj-quote-note">
            Processing time may be additional.
            Price excludes any additional applicable
            retail taxes.
          </p>

          <p className="cj-quote-note">
            GBP base total: £{quote.priceGBP}.
            International currency display is indicative.
            Preview only — checkout unavailable.
          </p>

        </div>
      )}

      {isDevelopment && (

        <>

          <button
            type="button"
            className="cj-detail-buy"
            disabled={!quote || loading}
            onClick={handleAddToBasket}
          >
            {added
              ? "Update Preview Basket"
              : "Add to Basket (Preview)"}
          </button>

          {basketMessage && (
            <p
              role="status"
              style={{
                color: added ? "#16794b" : "#b91c1c",
                marginTop: "12px"
              }}
            >
              {basketMessage}
            </p>
          )}

          {added && (
            <Link
              to="/basket"
              className="cj-view-basket-link"
            >
              View Basket →
            </Link>
          )}

        </>
      )}

    </>
  );
}

export default CJQuotePreview;

