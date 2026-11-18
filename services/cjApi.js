
require("dotenv").config();

const BASE_URL =
  process.env.CJ_API_BASE_URL ||
  "https://developers.cjdropshipping.com/api2.0/v1";

let accessToken = null;

// Create structured CJ API errors
function createCJError(message, {
  cjCode = null,
  httpStatus = null,
  stage,
  kind
} = {}) {
  const error = new Error(message);

  error.name = "CJApiError";
  error.cjCode = cjCode;
  error.httpStatus = httpStatus;
  error.stage = stage;
  error.kind = kind;

  return error;
}

// Handle network errors
async function fetchCJ(url, options, stage) {
  try {
    return await fetch(url, options);

  } catch (error) {
    throw createCJError(
      "CJ network request failed",
      {
        stage,
        kind: "network"
      }
    );
  }
}

// Preserve HTTP status and CJ error codes
async function readCJResponse(response, stage) {
  let result;

  try {
    result = await response.json();

  } catch {
    throw createCJError(
      response.ok
        ? "Invalid JSON response from CJ"
        : `CJ HTTP error: ${response.status}`,
      {
        httpStatus: response.status,
        stage,
        kind: response.ok
          ? "invalid_response"
          : "http"
      }
    );
  }

  if (!response.ok) {
    throw createCJError(
      result?.message ||
      `CJ HTTP error: ${response.status}`,
      {
        cjCode: result?.code ?? null,
        httpStatus: response.status,
        stage,
        kind: "http"
      }
    );
  }

  return result;
}

// Retrieve and cache CJ access token
async function getAccessToken() {
  if (accessToken) {
    return accessToken;
  }

  if (!process.env.CJ_API_KEY) {
    throw createCJError(
      "CJ_API_KEY is missing from .env",
      {
        stage: "authentication",
        kind: "configuration"
      }
    );
  }

  const response = await fetchCJ(
    `${BASE_URL}/authentication/getAccessToken`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        apiKey: process.env.CJ_API_KEY
      })
    },
    "authentication"
  );

  const result = await readCJResponse(
    response,
    "authentication"
  );

  if (
    !result?.result ||
    !result?.data?.accessToken
  ) {
    throw createCJError(
      result?.message ||
      "CJ authentication failed",
      {
        cjCode: result?.code ?? null,
        httpStatus: response.status,
        stage: "authentication",
        kind: "api"
      }
    );
  }

  accessToken = result.data.accessToken;

  return accessToken;
}

// Main CJ API request function
async function cjRequest(
  endpoint,
  method = "GET",
  body = null
) {
  const token = await getAccessToken();

  const options = {
    method,
    headers: {
      "CJ-Access-Token": token,
      "Content-Type": "application/json"
    }
  };

  if (body !== null) {
    options.body = JSON.stringify(body);
  }

  const response = await fetchCJ(
    `${BASE_URL}${endpoint}`,
    options,
    "request"
  );

  const result = await readCJResponse(
    response,
    "request"
  );

  if (
    result?.result !== true &&
    !(result?.result == null &&
      result?.success === true)
  ) {
    throw createCJError(
      result?.message || "CJ request failed",
      {
        cjCode: result?.code ?? null,
        httpStatus: response.status,
        stage: "request",
        kind: "api"
      }
    );
  }

  return result.data;
}

module.exports = {
  getAccessToken,
  cjRequest
};

