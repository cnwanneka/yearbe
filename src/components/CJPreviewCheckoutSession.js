
import React, {
  useEffect,
  useRef,
  useState
} from "react";

const API_BASE =
  "http://localhost:3001/api/cj/checkout";

const REQUEST_TIMEOUT = 90000;

function checkResponse(data, destination, expectedId) {
  const amountValid =
    Number.isSafeInteger(data?.amountPence) &&
    data.amountPence > 0 &&
    Number.isFinite(Number(data?.totalGBP)) &&
    Math.round(Number(data.totalGBP) * 100) ===
      data.amountPence;

  const validStatuses = [
    "preview_validated",
    "expired",
    "revalidation_required"
  ];

  if (
    data?.success !== true ||
    data.previewOnly !== true ||
    data.paymentAllowed !== false ||
    data.currency !== "GBP" ||
    data.destination !== destination ||
    typeof data.checkoutId !== "string" ||
    !validStatuses.includes(data.status) ||
    !amountValid ||
    !Number.isFinite(Date.parse(data.expiresAt)) ||
    (
      data.status === "preview_validated" &&
      data.validated !== true
    ) ||
    (
      data.status !== "preview_validated" &&
      data.validated !== false
    ) ||
    (
      expectedId &&
      data.checkoutId !== expectedId
    )
  ) {
    throw new Error(
      "Invalid CJ checkout session response"
    );
  }
}

export default function CJPreviewCheckoutSession({
  cjPreviewCart,
  destination,
  postcode,
  initialValidatedTotalGBP
}) {
  const [session, setSession] = useState(null);
  const [checkoutToken, setCheckoutToken] =
    useState("");

  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [verificationFailed, setVerificationFailed] =
    useState(false);

  const [now, setNow] = useState(Date.now());

  const controllerRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(
      () => setNow(Date.now()),
      1000
    );

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  const expiryTime = session
    ? Date.parse(session.expiresAt)
    : NaN;

  const locallyExpired =
    session &&
    Number.isFinite(expiryTime) &&
    now >= expiryTime;

  const effectiveStatus = !session
    ? ""
    : locallyExpired
      ? "expired"
      : session.status;

  const currentlyValidated =
    effectiveStatus === "preview_validated" &&
    session?.validated === true &&
    !verificationFailed;

  const priceChanged =
    session &&
    session.amountPence !==
      Math.round(
        Number(initialValidatedTotalGBP) * 100
      );

  async function sendRequest(action, payload) {
    const controller = new AbortController();

    controllerRef.current = controller;

    const timeout = setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT
    );

    try {
      const response = await fetch(
        `${API_BASE}/${action}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        }
      );

      const data = await response
        .json()
        .catch(() => null);

      if (controller.signal.aborted) {
        throw new Error("Request timed out");
      }

      if (!response.ok || data?.success !== true) {
        throw new Error(
          data?.error ||
          `CJ checkout request failed (HTTP ${response.status})`
        );
      }

      return data;

    } finally {
      clearTimeout(timeout);

      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    }
  }

  async function runAction(action) {
    if (
      process.env.NODE_ENV !== "development" ||
      busy ||
      controllerRef.current
    ) {
      return;
    }

    setBusy(action);
    setError("");

    try {
      let data;

      if (action === "create") {
        if (session) {
          throw new Error(
            "A checkout session already exists"
          );
        }

        const items = cjPreviewCart.map(item => ({
          variantId: Number(item.variantId),
          quantity: Number(item.quantity),
          shippingMethod: item.shippingMethod
        }));

        data = await sendRequest("create", {
          items,
          destination,
          postcode: postcode.trim()
        });

        checkResponse(data, destination);

        if (
          !/^[a-f0-9]{64}$/.test(
            data.checkoutToken || ""
          )
        ) {
          throw new Error(
            "Invalid checkout access token"
          );
        }

        // Keep the secret token only in React memory.
        // Never display or save it in localStorage.
        const {
          checkoutToken: token,
          ...sessionDetails
        } = data;

        setCheckoutToken(token);
        setSession(sessionDetails);

      } else {
        if (!session || !checkoutToken) {
          throw new Error(
            "No checkout session available"
          );
        }

        const checkoutId = session.checkoutId;

        data = await sendRequest(action, {
          checkoutId,
          checkoutToken
        });

        checkResponse(
          data,
          destination,
          checkoutId
        );

        const {
          checkoutToken: ignoredToken,
          ...sessionDetails
        } = data;

        setSession(sessionDetails);
      }

      setVerificationFailed(false);
      setNow(Date.now());

    } catch (requestError) {
      setError(
        requestError.name === "AbortError"
          ? "Request cancelled or timed out."
          : requestError.message
      );

      if (session) {
        // Fail closed if a session cannot be checked.
        setVerificationFailed(true);
      }

    } finally {
      setBusy("");
    }
  }

  return (
    <div
      style={{
        marginTop: "25px",
        padding: "20px",
        border: "1px solid #b7d3e5",
        borderRadius: "8px",
        backgroundColor: "#f5fbff"
      }}
    >
      <h3>Secure CJ Preview Checkout Session</h3>

      <p>
        Create a development checkout session
        using a fresh supplier validation.
        Payments and supplier orders are disabled.
      </p>

      {!session && (
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => runAction("create")}
        >
          {busy === "create"
            ? "Creating Checkout Session..."
            : "Create Preview Checkout Session"}
        </button>
      )}

      {session && (
        <>
          <p>
            <strong>Checkout status:</strong>{" "}
            {verificationFailed
              ? "Verification unavailable"
              : effectiveStatus}
          </p>

          <p>
            <strong>Checkout reference:</strong>{" "}
            {session.checkoutId}
          </p>

          <p>
            <strong>Trusted checkout total:</strong>{" "}
            £{(session.amountPence / 100).toFixed(2)}
          </p>

          <p>
            <strong>Revision:</strong>{" "}
            {session.revision}
          </p>

          <p>
            <strong>Expiry:</strong>{" "}
            {new Date(
              session.expiresAt
            ).toLocaleString("en-GB")}
          </p>

          <p>
            <strong>Session valid:</strong>{" "}
            {currentlyValidated ? "Yes" : "No"}
          </p>

          <p>
            <strong>Payment allowed:</strong> No
          </p>

          {priceChanged && (
            <p role="status">
              The server-validated checkout price
              differs from the earlier basket quote.
              Review the new total.
            </p>
          )}

          {session.conditional && (
            <p>
              Conditional availability: supplier
              procurement may be required.
              Inventory is not guaranteed.
            </p>
          )}

          {!currentlyValidated && (
            <p role="alert">
              This session is not currently valid.
              Revalidation is required before
              treating its quotation as current.
            </p>
          )}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px"
            }}
          >
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => runAction("status")}
            >
              {busy === "status"
                ? "Checking..."
                : "Check Session Status"}
            </button>

            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => runAction("revalidate")}
            >
              {busy === "revalidate"
                ? "Revalidating..."
                : "Revalidate Supplier Quote"}
            </button>
          </div>
        </>
      )}

      {busy && (
        <p role="status">
          Contacting the Yearbe backend.
          Please do not submit another request.
        </p>
      )}

      {error && (
        <p
          role="alert"
          style={{ color: "#b00020" }}
        >
          {error}
        </p>
      )}

      <p
        style={{
          fontSize: "13px",
          color: "#555",
          marginTop: "15px"
        }}
      >
        Development testing only. The session token
        stays in browser memory and is discarded
        when this component is removed or the
        page is refreshed.
      </p>
    </div>
  );
}
