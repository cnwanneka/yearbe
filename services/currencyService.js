
const SUPPORTED_CURRENCIES = [
  "GBP", "USD", "EUR", "CAD",
  "AUD", "NGN", "INR", "ZAR"
];

const CACHE_DURATION = 6 * 60 * 60 * 1000;

let cachedRates = null;
let lastUpdated = 0;

async function getExchangeRates() {
  if (
    cachedRates &&
    Date.now() - lastUpdated < CACHE_DURATION
  ) {
    return cachedRates;
  }

  const currencies = SUPPORTED_CURRENCIES
    .filter(currency => currency !== "GBP")
    .join(",");

  const response = await fetch(
    `https://api.frankfurter.dev/v2/rates?base=GBP&quotes=${currencies}`,
    { signal: AbortSignal.timeout(10000) }
  );

  if (!response.ok) {
    throw new Error("Unable to retrieve exchange rates");
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error("Invalid exchange-rate response");
  }

  const rates = {
    GBP: 1
  };

  for (const item of data) {
    const rate = Number(item.rate);

    if (
      item.base === "GBP" &&
      SUPPORTED_CURRENCIES.includes(item.quote) &&
      Number.isFinite(rate) &&
      rate > 0
    ) {
      rates[item.quote] = rate;
    }
  }

  cachedRates = rates;
  lastUpdated = Date.now();

  return rates;
}

async function convertGBP(amount, currency = "GBP") {
  currency = currency.toUpperCase();
  amount = Number(amount);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Invalid GBP amount");
  }

  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    throw new Error("Unsupported currency");
  }

  const rates = currency === "GBP"
    ? { GBP: 1 }
    : await getExchangeRates();

  const rate = rates[currency];

  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(
      `Exchange rate unavailable for ${currency}`
    );
  }

  const converted = amount * rate;

  const formatted = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency
  }).format(converted);

  return {
    baseAmountGBP: amount.toFixed(2),
    currency,
    exchangeRate: rate,
    formattedPrice: formatted
  };
}

module.exports = {
  getExchangeRates,
  convertGBP,
  SUPPORTED_CURRENCIES
};
