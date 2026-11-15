
require("dotenv").config();

const BASE_URL =
  process.env.CJ_API_BASE_URL ||
  "https://developers.cjdropshipping.com/api2.0/v1";

let accessToken = null;

async function getAccessToken() {
  if (accessToken) {
    return accessToken;
  }

  if (!process.env.CJ_API_KEY) {
    throw new Error("CJ_API_KEY is missing from .env");
  }

  const response = await fetch(
    `${BASE_URL}/authentication/getAccessToken`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        apiKey: process.env.CJ_API_KEY
      })
    }
  );

  if (!response.ok) {
    throw new Error(
      `CJ authentication HTTP error: ${response.status}`
    );
  }

  const result = await response.json();

  if (!result.result || !result.data?.accessToken) {
    throw new Error(
      result.message || "CJ authentication failed"
    );
  }

  accessToken = result.data.accessToken;

  return accessToken;
}

async function cjRequest(endpoint) {
  const token = await getAccessToken();

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: "GET",
    headers: {
      "CJ-Access-Token": token
    }
  });

  if (!response.ok) {
    throw new Error(
      `CJ API HTTP error: ${response.status}`
    );
  }

  const result = await response.json();

  if (!result.result) {
    throw new Error(
      result.message || "CJ request failed"
    );
  }

  return result.data;
}

module.exports = {
  getAccessToken,
  cjRequest
};
