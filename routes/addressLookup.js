const express = require("express");
const { rateLimit } = require("express-rate-limit");

const router = express.Router();

const BASE_URL =
  "https://api.ideal-postcodes.co.uk/v1";

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many searches. Please try again shortly."
  }
});

const resolveLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many address requests. Please try again shortly."
  }
});

router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

async function idealPostcodesRequest(
  endpoint,
  parameters = {}
) {
  const apiKey =
    process.env.IDEAL_POSTCODES_API_KEY;

  if (!apiKey) {
    throw new Error(
      "IDEAL_POSTCODES_API_KEY is missing"
    );
  }

  const url = new URL(`${BASE_URL}${endpoint}`);

  url.searchParams.set("api_key", apiKey);

  for (const [key, value] of Object.entries(parameters)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    signal: AbortSignal.timeout(10000)
  });

  const data = await response.json();

  if (!response.ok || data.code !== 2000) {
    const error = new Error(
      "Address provider request failed"
    );

    error.providerStatus = response.status;
    error.providerCode = data.code;

    throw error;
  }

  return data.result;
}


// Search for address suggestions
router.post("/search", searchLimiter, async (req, res) => {

  const query =
    typeof req.body?.query === "string"
      ? req.body.query.trim()
      : "";

  if (query.length < 3 || query.length > 120) {
    return res.status(400).json({
      success: false,
      error: "Invalid address search"
    });
  }

  try {

    const result = await idealPostcodesRequest(
      "/autocomplete/addresses",
      {
        query,
        context: "GBR",
        limit: "20"
      }
    );

    if (!Array.isArray(result?.hits)) {
      throw new Error("Invalid address response");
    }

    const suggestions = result.hits
      .filter(item =>
        typeof item.id === "string" &&
        typeof item.suggestion === "string"
      )
      .map(item => ({
        id: item.id,
        text: item.suggestion
      }));

    res.json({
      success: true,
      suggestions
    });

  } catch (error) {

    console.error(
      "Address search failed:",
      error.providerStatus || "",
      error.providerCode || "",
      error.message
    );

    res.status(502).json({
      success: false,
      error:
        "Unable to fetch addresses. Please enter your address manually."
    });
  }
});


// Retrieve the complete selected address
router.post("/resolve", resolveLimiter, async (req, res) => {

  const id = req.body?.id;

  if (
    typeof id !== "string" ||
    !/^[A-Za-z0-9_-]{1,200}$/.test(id)
  ) {
    return res.status(400).json({
      success: false,
      error: "Invalid address ID"
    });
  }

  try {

    const result = await idealPostcodesRequest(
      `/autocomplete/addresses/${encodeURIComponent(id)}/gbr`
    );

    if (
      !result?.line_1 ||
      !result?.post_town ||
      !result?.postcode
    ) {
      throw new Error("Incomplete address response");
    }

    res.json({
      success: true,
      address: {
        addressLine1: result.line_1,
        addressLine2: result.line_2 || "",
        addressLine3: result.line_3 || "",
        townCity: result.post_town,
        postcode: result.postcode
      }
    });

  } catch (error) {

    console.error(
      "Address resolution failed:",
      error.providerStatus || "",
      error.providerCode || "",
      error.message
    );

    res.status(502).json({
      success: false,
      error:
        "Unable to retrieve selected address. Please try manual entry."
    });
  }
});

module.exports = router;