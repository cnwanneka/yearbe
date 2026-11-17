
const {
  convertGBP,
  SUPPORTED_CURRENCIES
} = require("./services/currencyService");

async function testCurrency() {
  try {
    const amount = 27.41;
    const results = [];

    console.log("Yearbe base price: £" + amount);

    for (const currency of SUPPORTED_CURRENCIES) {
      const result = await convertGBP(amount, currency);

      results.push({
        currency: result.currency,
        exchangeRate: result.exchangeRate,
        displayPrice: result.formattedPrice
      });
    }

    console.table(results);

    console.log("Currency conversion test completed!");

  } catch (error) {
    console.error(
      "Currency test failed:",
      error.message
    );
    process.exitCode = 1;
  }
}

testCurrency();
