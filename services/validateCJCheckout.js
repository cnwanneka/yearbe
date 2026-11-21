
const pool = require("../database/db");
const { cjRequest } = require("./cjApi");
const { getProductQuote } = require("./cjPricing");

const MAX_ITEMS = 5;
const ORIGIN = "CN";

const SUPPORTED_DESTINATIONS = [
  "GB", "US", "CA", "AU",
  "DE", "FR", "NG", "IN", "ZA"
];

const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

class CheckoutValidationError extends Error {
  constructor(message, status = 422) {
    super(message);
    this.status = status;
  }
}

function positiveNumber(value) {
  if (
    value == null ||
    value === "" ||
    !["number", "string"].includes(typeof value)
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) && number > 0
    ? number
    : null;
}

function sufficientStock(value, quantity) {
  if (
    value == null ||
    value === "" ||
    !["number", "string"].includes(typeof value)
  ) {
    return false;
  }

  const number = Number(value);

  return (
    Number.isSafeInteger(number) &&
    number >= quantity
  );
}


// Determine the safest available stock source
function getInventoryDecision(warehouses, quantity) {

  if (!Array.isArray(warehouses)) {
    return null;
  }

  // Only consider inventory in the selected origin
  const originWarehouses = warehouses.filter(
    warehouse =>
      warehouse?.countryCode === ORIGIN
  );

  // Priority 1: Verified CJ warehouse inventory
  const cjWarehouse = originWarehouses.find(
    warehouse =>
      String(warehouse.verifiedWarehouse) === "1" &&
      sufficientStock(
        warehouse.cjInventory,
        quantity
      ) &&
      sufficientStock(
        warehouse.totalInventory,
        quantity
      )
  );

  if (cjWarehouse) {
    return {
      stockSource: "cj_warehouse",
      inventoryVerified: true,
      verifiedWarehouse: 1,
      requiresProcurement: false,
      conditional: false,
      processingTimeDays: {
        min: 1,
        max: 2
      },
      procurementWarning: null
    };
  }

  // Priority 2: Verified factory inventory
  const verifiedFactory = originWarehouses.find(
    warehouse =>
      String(warehouse.verifiedWarehouse) === "1" &&
      sufficientStock(
        warehouse.factoryInventory,
        quantity
      ) &&
      sufficientStock(
        warehouse.totalInventory,
        quantity
      )
  );

  if (verifiedFactory) {
    return {
      stockSource: "factory",
      inventoryVerified: true,
      verifiedWarehouse: 1,
      requiresProcurement: true,
      conditional: true,
      processingTimeDays: {
        min: 3,
        max: 5
      },
      procurementWarning:
        "Product requires supplier procurement. " +
        "Estimated processing time is 3-5 days " +
        "before shipping. Availability is not guaranteed."
    };
  }

  // Priority 3: Factory inventory awaiting verification
  // Development preview only
  const unverifiedFactory = originWarehouses.find(
    warehouse =>
      String(warehouse.verifiedWarehouse) === "2" &&
      sufficientStock(
        warehouse.factoryInventory,
        quantity
      ) &&
      sufficientStock(
        warehouse.totalInventory,
        quantity
      )
  );

  if (unverifiedFactory) {
    return {
      stockSource: "factory",
      inventoryVerified: false,
      verifiedWarehouse: 2,
      requiresProcurement: true,
      conditional: true,
      processingTimeDays: {
        min: 3,
        max: 5
      },
      procurementWarning:
        "Factory inventory is awaiting verification. " +
        "Supplier procurement is required. " +
        "Estimated processing time is 3-5 days " +
        "before shipping and may be longer. " +
        "Availability is not guaranteed. " +
        "Payment remains disabled."
    };
  }

  // Unknown or insufficient eligible inventory
  return null;
}


async function validateCJCheckout({
  items,
  destination,
  postcode = ""
} = {}) {

  // Validate the incoming basket
  if (
    !Array.isArray(items) ||
    items.length === 0 ||
    items.length > MAX_ITEMS
  ) {
    throw new CheckoutValidationError(
      `Basket must contain between 1 and ${MAX_ITEMS} items`,
      400
    );
  }

  if (!SUPPORTED_DESTINATIONS.includes(destination)) {
    throw new CheckoutValidationError(
      "Invalid delivery country",
      400
    );
  }

  if (
    typeof postcode !== "string" ||
    postcode.length > 20 ||
    !/^[A-Za-z0-9 -]*$/.test(postcode)
  ) {
    throw new CheckoutValidationError(
      "Invalid delivery postcode",
      400
    );
  }

  postcode = postcode.trim();

  if (destination === "GB" && !postcode) {
    throw new CheckoutValidationError(
      "A UK delivery postcode is required",
      400
    );
  }

  const seenVariants = new Set();

  for (const item of items) {

    if (
      !item ||
      !Number.isInteger(item.variantId) ||
      item.variantId < 1 ||
      item.variantId > 2147483647 ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 20 ||
      typeof item.shippingMethod !== "string" ||
      !item.shippingMethod.trim() ||
      item.shippingMethod.length > 120
    ) {
      throw new CheckoutValidationError(
        "Invalid basket item",
        400
      );
    }

    // Prevent duplicate lines bypassing stock checks
    if (seenVariants.has(item.variantId)) {
      throw new CheckoutValidationError(
        "Duplicate variant. Combine quantities before validation.",
        400
      );
    }

    seenVariants.add(item.variantId);
  }

  let lockClient;

  try {

    // Prevent overlap with scheduled CJ synchronisation
    lockClient = await pool.connect();

    const lock = await lockClient.query(
      "SELECT pg_try_advisory_lock(81001) AS locked"
    );

    if (!lock.rows[0].locked) {
      throw new CheckoutValidationError(
        "Product synchronisation is running. Please try again later.",
        503
      );
    }

    const validatedItems = [];

    let totalPence = 0;

    for (const item of items) {

      const {
        variantId,
        quantity,
        shippingMethod
      } = item;

      // Retrieve trusted product data from PostgreSQL
      const result = await lockClient.query(`
        SELECT
          v.id,
          v.cj_variant_id,
          v.sku,
          v.supplier_price_usd,
          v.stock_checked_at,
          v.cost_gbp_updated_at,
          p.variants_synced_at,
          p.cj_product_id,
          p.name
        FROM cj_variants v
        JOIN cj_products p
          ON p.id = v.product_id
        WHERE v.id = $1
          AND p.status = 'draft'
      `, [variantId]);

      if (result.rows.length !== 1) {
        throw new CheckoutValidationError(
          "Product variant not found"
        );
      }

      const variant = result.rows[0];

      console.log("Validating:", variant.name);

      if (!variant.sku) {
        throw new CheckoutValidationError(
          "Product SKU unavailable"
        );
      }

      // Reject invalid or outdated stored timestamps
      const stockTime =
        new Date(variant.stock_checked_at).getTime();

      const costTime =
        new Date(variant.cost_gbp_updated_at).getTime();

      const now = Date.now();

      if (
        !variant.stock_checked_at ||
        !Number.isFinite(stockTime) ||
        stockTime > now ||
        now - stockTime > 24 * 60 * 60 * 1000
      ) {
        throw new CheckoutValidationError(
          "Inventory needs refreshing"
        );
      }

      if (
        !variant.cost_gbp_updated_at ||
        !Number.isFinite(costTime) ||
        costTime > now ||
        now - costTime > 72 * 60 * 60 * 1000
      ) {
        throw new CheckoutValidationError(
          "GBP costs need refreshing"
        );
      }

      const variantTime = new Date(
        variant.variants_synced_at
      ).getTime();

      if (
        !variant.variants_synced_at ||
        !Number.isFinite(variantTime) ||
        variantTime > now ||
        costTime < variantTime
      ) {
        throw new CheckoutValidationError(
          "GBP costs must be refreshed after variant synchronisation"
        );
      }

      // Verify the product directly with CJ
      let details;

      try {

        details = await cjRequest(
          `/product/query?pid=${encodeURIComponent(
            variant.cj_product_id
          )}`
        );

      } catch (error) {

        const productNotFound =
          error.stage === "request" &&
          String(error.cjCode) === "1602001" &&
          (
            error.kind === "api" ||
            (
              error.kind === "http" &&
              error.httpStatus === 404
            )
          );

        if (productNotFound) {
          throw new CheckoutValidationError(
            "Product is no longer available from CJ"
          );
        }

        throw error;
      }

      if (
        !details?.pid ||
        String(details.pid) !==
          String(variant.cj_product_id) ||
        !Array.isArray(details.variants)
      ) {
        throw new Error("Invalid CJ product response");
      }

      const matchingVariants =
        details.variants.filter(option =>
          String(option.vid) ===
          String(variant.cj_variant_id)
        );

      if (matchingVariants.length !== 1) {
        throw new CheckoutValidationError(
          "Selected product option is unavailable"
        );
      }

      const liveVariant = matchingVariants[0];

      // Compare live supplier price with stored USD price
      const livePrice = positiveNumber(
        liveVariant.variantSellPrice
      );

      const storedPrice = positiveNumber(
        variant.supplier_price_usd
      );

      if (
        livePrice === null ||
        storedPrice === null ||
        Math.abs(livePrice - storedPrice) > 0.00000001
      ) {
        throw new CheckoutValidationError(
          "Supplier price has changed or is unavailable. Price refresh required."
        );
      }

      await sleep(1500);

      // Retrieve live warehouse inventory
      const stockData = await cjRequest(
        `/product/stock/getInventoryByPid?pid=${
          encodeURIComponent(variant.cj_product_id)
        }`
      );

      if (
        !Array.isArray(stockData?.variantInventories)
      ) {
        throw new Error("Invalid CJ inventory response");
      }

      const matchingInventory =
        stockData.variantInventories.filter(option =>
          String(option.vid) ===
          String(variant.cj_variant_id)
        );

      if (
        matchingInventory.length !== 1 ||
        !Array.isArray(matchingInventory[0].inventory)
      ) {
        throw new CheckoutValidationError(
          "Selected variant inventory unavailable"
        );
      }

      const warehouses =
        matchingInventory[0].inventory;


      // NEW: Support warehouse and factory inventory
      const inventoryDecision = getInventoryDecision(
        warehouses,
        quantity
      );

      if (!inventoryDecision) {
        throw new CheckoutValidationError(
          "Insufficient eligible warehouse or factory stock for " +
          variant.name
        );
      }

      console.log(
        "Stock source:",
        inventoryDecision.stockSource
      );

      console.log(
        "Inventory verified:",
        inventoryDecision.inventoryVerified
      );

      console.log(
        "Procurement required:",
        inventoryDecision.requiresProcurement
      );

      if (inventoryDecision.procurementWarning) {
        console.log(
          inventoryDecision.procurementWarning
        );
      }

      await sleep(1500);

      // Recalculate shipping and selling price
      // using the existing trusted pricing service
      let quote;

      try {

        quote = await getProductQuote({
          sku: variant.sku,
          variantId,
          destination,
          quantity,
          preferredMethod: shippingMethod,
          origin: ORIGIN,
          postcode
        });

      } catch (error) {

        const safeErrors = [
          "Inventory needs refreshing",
          "GBP costs need refreshing",
          "Insufficient reported stock",
          "No shipping options available",
          "Requested shipping method unavailable",
          "Invalid supplier cost or exchange rate"
        ];

        if (safeErrors.includes(error.message)) {
          throw new CheckoutValidationError(
            error.message
          );
        }

        throw error;
      }

      const pricePence = Math.round(
        Number(quote.sellingPriceGBP) * 100
      );

      if (
        !Number.isSafeInteger(pricePence) ||
        pricePence <= 0
      ) {
        throw new Error("Invalid calculated price");
      }

      totalPence += pricePence;

      if (!Number.isSafeInteger(totalPence)) {
        throw new Error("Invalid basket total");
      }


      // NEW: Include stock source and processing information
      validatedItems.push({
        variantId,
        title: variant.name,
        sku: variant.sku,
        quantity,
        origin: ORIGIN,
        destination,
        shippingMethod: quote.shippingMethod,
        transitTime: quote.transitTime || null,
        totalGBP: (pricePence / 100).toFixed(2),

        stockSource:
          inventoryDecision.stockSource,

        inventoryVerified:
          inventoryDecision.inventoryVerified,

        verifiedWarehouse:
          inventoryDecision.verifiedWarehouse,

        requiresProcurement:
          inventoryDecision.requiresProcurement,

        conditional:
          inventoryDecision.conditional,

        processingTimeDays:
          inventoryDecision.processingTimeDays,

        procurementWarning:
          inventoryDecision.procurementWarning
      });

      console.log(
        inventoryDecision.conditional
          ? "Conditional preview validation passed:"
          : "Preview validation passed:",
        variant.name
      );

      await sleep(1500);
    }


    // Check whether any basket item requires procurement
    const requiresProcurement = validatedItems.some(
      item => item.requiresProcurement
    );

    const conditional = validatedItems.some(
      item => item.conditional
    );

    const warnings = validatedItems
      .filter(item => item.procurementWarning)
      .map(item => ({
        variantId: item.variantId,
        title: item.title,
        message: item.procurementWarning
      }));


    return {
      success: true,
      validated: true,
      previewOnly: true,
      paymentAllowed: false,

      conditional,
      requiresProcurement,

      currency: "GBP",
      destination,
      items: validatedItems,
      warnings,

      totalGBP: (totalPence / 100).toFixed(2),
      validatedAt: new Date().toISOString()
    };

  } finally {

    // Close the lock connection
    // and release the advisory lock
    if (lockClient) {
      lockClient.release(true);
    }
  }
}

module.exports = {
  validateCJCheckout,
  CheckoutValidationError
};