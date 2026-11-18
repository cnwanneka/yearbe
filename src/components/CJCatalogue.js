
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./CJCatalogue.css";

const API = "http://localhost:3001/api/cj";

function CJCatalogue() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categoryError, setCategoryError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function fetchCategories() {
      try {
        const response = await fetch(
          `${API}/categories`,
          { signal: controller.signal }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error("Unable to load categories");
        }

        setCategories(data.categories);

      } catch (error) {
        if (!controller.signal.aborted) {
          setCategoryError(error.message);
        }
      }
    }

    fetchCategories();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchProducts() {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams({
          page: String(page),
          limit: "20",
          search,
          category
        });

        const response = await fetch(
          `${API}/products?${params}`,
          { signal: controller.signal }
        );

        const data = await response.json();

        if (!response.ok || !data.success ||
            !Array.isArray(data.products)) {
          throw new Error("Unable to load products");
        }

        setProducts(data.products);
        setTotal(data.total);
        setTotalPages(data.totalPages);

      } catch (error) {
        if (!controller.signal.aborted) {
          setError(error.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchProducts();

    return () => controller.abort();
  }, [page, search, category]);

  function handleSearch(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setCategory("");
    setPage(1);
  }

  return (
    <main className="cj-catalogue">
      <h1>Explore Yearbe</h1>

      <p className="cj-subtitle">
        Discover fashion, home essentials,
        electronics and much more.
      </p>

      <div className="cj-preview-notice">
        Development preview — products are not
        yet available for purchase.
      </div>

      <div className="cj-filter-bar">
        <form
          className="cj-search-form"
          onSubmit={handleSearch}
        >
          <input
            type="search"
            placeholder="Search Yearbe products..."
            aria-label="Search products"
            maxLength={100}
            value={searchInput}
            onChange={event =>
              setSearchInput(event.target.value)
            }
          />

          <button type="submit">
            Search
          </button>
        </form>

        <select
          aria-label="Product category"
          value={category}
          onChange={event => {
            setCategory(event.target.value);
            setPage(1);
          }}
        >
          <option value="">
            All Categories
          </option>

          {categories.map(item => (
            <option
              key={item.name}
              value={item.name}
            >
              {item.name} ({item.product_count})
            </option>
          ))}
        </select>

        <button
          className="cj-clear-filters"
          onClick={clearFilters}
        >
          Clear Filters
        </button>
      </div>

      {categoryError && (
        <p className="cj-error">{categoryError}</p>
      )}

      {!loading && !error && (
        <p className="cj-product-count">
          {total} products found
        </p>
      )}

      {loading && (
        <p className="cj-message">
          Loading products...
        </p>
      )}

      {error && (
        <p className="cj-error">{error}</p>
      )}

      {!loading && !error && (
        <>
          <div className="cj-product-grid">
            {products.map(product => (
              <article
                className="cj-product-card"
                key={product.id}
              >
                <Link
                  className="cj-image-container"
                  to={`/cj-catalogue/${product.id}`}
                >
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      loading="lazy"
                      onError={event => {
                        event.currentTarget.style.display =
                          "none";
                      }}
                    />
                  ) : (
                    <span>Image unavailable</span>
                  )}
                </Link>

                <div className="cj-product-info">
                  <p className="cj-category-label">
                    {product.category_name}
                  </p>

                  <h3>{product.name}</h3>

                  <p>
                    {product.variant_count} options
                  </p>

                  <Link
                    className="cj-view-product"
                    to={`/cj-catalogue/${product.id}`}
                  >
                    View Product
                  </Link>
                </div>
              </article>
            ))}
          </div>

          {products.length === 0 && (
            <p className="cj-message">
              No matching products found.
            </p>
          )}

          {totalPages > 1 && (
            <div className="cj-pagination">
              <button
                disabled={page <= 1}
                onClick={() => {
                  setPage(previous => previous - 1);
                  window.scrollTo(0, 0);
                }}
              >
                Previous
              </button>

              <span>
                Page {page} of {totalPages}
              </span>

              <button
                disabled={page >= totalPages}
                onClick={() => {
                  setPage(previous => previous + 1);
                  window.scrollTo(0, 0);
                }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}

export default CJCatalogue;
