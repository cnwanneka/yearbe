
const { cjRequest } = require("./services/cjApi");

async function testV2() {
  try {
    const data = await cjRequest(
      "/product/listV2?page=1&size=20"
    );

    console.log("CJ V2 API connected successfully!");

    console.log(
      "Response fields:",
      Object.keys(data || {})
    );

    console.log(
      "Total products reported:",
      data?.totalRecords
    );

    const products =
      data?.content?.flatMap(
        (group) => group.productList || []
      ) || [];

    console.log("Products received:", products.length);

    console.log(
      "First product:",
      JSON.stringify(products[0] || null, null, 2)
        .slice(0, 2000)
    );
  } catch (error) {
    console.error("CJ V2 error:", error.message);
    process.exitCode = 1;
  }
}

testV2();
