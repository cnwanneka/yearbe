
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import "./CJProductDetail.css";
import CJQuotePreview from "./CJQuotePreview";

function CJProductDetail() {
  const { id } = useParams();

  const [product, setProduct] = useState(null);
  const [variants, setVariants] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function fetchProduct() {
      try {
        setLoading(true);
        setError("");
        setProduct(null);
        setVariants([]);
        setSelectedId("");
        setQuantity(1);

        const response = await fetch(
          `http://localhost:3001/api/cj/products/${id}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error("Unable to load product");
        }

        const data = await response.json();

        if (
          !data.success ||
          !data.product ||
          !Array.isArray(data.variants)
        ) {
          throw new Error("Invalid product response");
        }

        if (controller.signal.aborted) {
          return;
        }

        setProduct(data.product);
        setVariants(data.variants);

        setSelectedId(
          data.variants.length > 0
            ? String(data.variants[0].id)
            : ""
        );

      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchProduct();

    return () => controller.abort();
  }, [id]);

  const selectedVariant = variants.find(
    variant => String(variant.id) === selectedId
  );

  const image =
    selectedVariant?.variant_image_url ||
    product?.image_url;

  if (loading) {
    return (
      <p className="cj-detail-message">
        Loading product...
      </p>
    );
  }

  if (error || !product) {
    return (
      <div className="cj-detail-message">
        <p>{error || "Product not found"}</p>

        <Link to="/cj-catalogue">
          Back to catalogue
        </Link>
      </div>
    );
  }

  return (
    <main className="cj-detail-page">

      <Link
        className="cj-back-link"
        to="/cj-catalogue"
      >
        ← Back to catalogue
      </Link>

      <div className="cj-detail-grid">

        <div className="cj-detail-image">

          {image ? (
            <img
              key={image}
              src={image}
              alt={product.name}
              onError={event => {
                if (
                  product.image_url &&
                  event.currentTarget.src !==
                    product.image_url
                ) {
                  event.currentTarget.src =
                    product.image_url;
                }
              }}
            />
          ) : (
            <p>Image unavailable</p>
          )}

        </div>

        <div className="cj-detail-information">

          <h1>{product.name}</h1>

          <p className="cj-detail-preview">
            Product preview — you can test adding
            this product to your basket.
            Purchasing is not yet available.
          </p>

          <label htmlFor="cj-variant">
            Select colour / size / option
          </label>

          <select
            id="cj-variant"
            value={selectedId}
            disabled={variants.length === 0}
            onChange={event =>
              setSelectedId(event.target.value)
            }
          >
            {variants.length === 0 && (
              <option value="">
                No options available
              </option>
            )}

            {variants.map(variant => (
              <option
                key={variant.id}
                value={String(variant.id)}
              >
                {variant.variant_key ||
                  variant.sku ||
                  `Option ${variant.id}`}
              </option>
            ))}
          </select>

          {selectedVariant && (
            <p>
              SKU: {selectedVariant.sku}
            </p>
          )}

          <label htmlFor="cj-quantity">
            Quantity
          </label>

          <select
            id="cj-quantity"
            value={quantity}
            disabled={!selectedVariant}
            onChange={event =>
              setQuantity(Number(event.target.value))
            }
          >
            {Array.from({ length: 20 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>

          {/* Pricing and preview basket integration */}
          {selectedVariant && (
            <CJQuotePreview
              key={product.id}
              product={product}
              selectedVariant={selectedVariant}
              variantId={selectedVariant.id}
              quantity={quantity}
            />
          )}

          {!selectedVariant && (
            <button
              className="cj-detail-buy"
              disabled
            >
              Product Options Unavailable
            </button>
          )}

        </div>
      </div>
    </main>
  );
}

export default CJProductDetail;

