
const pool = require("../database/db");
const { cjRequest } = require("./cjApi");

const TARGET_MARGIN = 0.30;
const PAYMENT_FEE_RATE = 0.0515;
const FIXED_PAYMENT_FEE = 0.20;

async function getProductQuote({
  sku,
  destination = "GB",
  quantity = 1,
  preferredMethod = "",
  origin = "CN",
  postcode = ""
}) {
  destination = destination.toUpperCase();
  origin = origin.toUpperCase();

  if (!/^[A-Z]{2}$/.test(destination) ||
      !/^[A-Z]{2}$/.test(origin)) {
    throw new Error("Invalid country code");
  }

  if (!Number.isInteger(quantity) ||
      quantity < 1 || quantity > 20) {
    throw new Error("Quantity must be between 1 and 20");
  }

  const result = await pool.query(`
    SELECT
      v.cj_variant_id,
      v.sku,
      v.cost_gbp,
      v.usd_to_gbp_rate,
      v.warehouse_inventory,
      v.stock_checked_at,
      v.cost_gbp_updated_at,
      p.name
    FROM cj_variants v
    JOIN cj_products p ON p.id = v.product_id
    WHERE v.sku = $1
    LIMIT 1
  `, [sku]);

  if (result.rows.length === 0) {
    throw new Error("Product variant not found");
  }

  const variant = result.rows[0];

  const unitCost = Number(variant.cost_gbp);
  const rate = Number(variant.usd_to_gbp_rate);

  if (!Number.isFinite(unitCost) || unitCost <= 0 ||
      !Number.isFinite(rate) || rate <= 0) {
    throw new Error("Invalid supplier cost or exchange rate");
  }

  // Reject old inventory snapshots
  if (!variant.stock_checked_at ||
      Date.now() - new Date(variant.stock_checked_at).getTime()
        > 24 * 60 * 60 * 1000) {
    throw new Error("Inventory needs refreshing");
  }

  // Reject old currency conversion data
  if (!variant.cost_gbp_updated_at ||
      Date.now() - new Date(variant.cost_gbp_updated_at).getTime()
        > 72 * 60 * 60 * 1000) {
    throw new Error("GBP costs need refreshing");
  }

  const available =
    Array.isArray(variant.warehouse_inventory) &&
    variant.warehouse_inventory.some(
      warehouse =>
        warehouse.countryCode === origin &&
        Number(warehouse.totalInventory) >= quantity
    );

  if (!available) {
    throw new Error("Insufficient reported stock");
  }

  const shipping = await cjRequest(
    "/logistic/freightCalculate",
    "POST",
    {
      startCountryCode: origin,
      endCountryCode: destination,
      ...(postcode ? { zip: postcode } : {}),
      products: [
        {
          quantity,
          vid: variant.cj_variant_id
        }
      ]
    }
  );

  if (!Array.isArray(shipping)) {
    throw new Error("Invalid shipping response");
  }

  const options = shipping
    .filter(option =>
      option.logisticName &&
      option.totalPostageFee != null &&
      option.totalPostageFee !== "" &&
      Number.isFinite(Number(option.totalPostageFee)) &&
      Number(option.totalPostageFee) >= 0
    )
    .sort((a, b) =>
      Number(a.totalPostageFee) -
      Number(b.totalPostageFee)
    );

  if (options.length === 0) {
    throw new Error("No shipping options available");
  }

  const selected = preferredMethod
    ? options.find(option =>
        option.logisticName === preferredMethod
      )
    : options[0];

  if (!selected) {
    throw new Error("Requested shipping method unavailable");
  }

  const supplierCostGBP =
    Math.round(unitCost * quantity * 100) / 100;

  const shippingGBP =
    Math.round(
      Number(selected.totalPostageFee) * rate * 100
    ) / 100;

  const totalCost = supplierCostGBP + shippingGBP;

  const sellingPrice = Math.ceil(
    ((totalCost + FIXED_PAYMENT_FEE) /
      (1 - TARGET_MARGIN - PAYMENT_FEE_RATE)) * 100
  ) / 100;

  const paymentFee =
    sellingPrice * PAYMENT_FEE_RATE +
    FIXED_PAYMENT_FEE;

  const contribution =
    sellingPrice - totalCost - paymentFee;

  return {
    product: variant.name,
    sku: variant.sku,
    quantity,
    origin,
    destination,
    currency: "GBP",
    shippingMethod: selected.logisticName,
    transitTime: selected.logisticAging,
    supplierCostGBP: supplierCostGBP.toFixed(2),
    shippingCostGBP: shippingGBP.toFixed(2),
    totalCostGBP: totalCost.toFixed(2),
    estimatedPaymentFeeGBP: paymentFee.toFixed(2),
    sellingPriceGBP: sellingPrice.toFixed(2),
    estimatedContributionGBP: contribution.toFixed(2),
    estimatedMargin:
      ((contribution / sellingPrice) * 100).toFixed(2) + "%",
    previewOnly: true
  };
}

module.exports = { getProductQuote };
