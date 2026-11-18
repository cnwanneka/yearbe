
import React, { useState, useEffect } from "react";

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

function CJQuotePreview({ variantId, quantity }) {
  const [destination, setDestination] = useState("GB");
  const [currency, setCurrency] = useState("GBP");

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const requestKey = JSON.stringify([
    variantId, quantity, destination, currency
  ]);

  const currentResult =
    result?.key === requestKey ? result : null;

  useEffect(() => {
    setResult(null);
  }, [variantId, quantity, destination, currency]);

  async function calculatePrice() {
    try {
      setLoading(true);
      setResult(null);

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
          signal: AbortSignal.timeout(30000)
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Unable to calculate price"
        );
      }

      setResult({
        key: requestKey,
        quote: data
      });

    } catch (error) {
      setResult({
        key: requestKey,
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  }

  const quote = currentResult?.quote;

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

      {currentResult?.error && (
        <p className="cj-quote-error">
          {currentResult.error}
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

    </div>
  );
}

export default CJQuotePreview;
