
const { cjRequest } = require("./services/cjApi");

async function testCJProducts() {
  try {
    const data = await cjRequest(
      "/product/list?pageNum=1&pageSize=20"
    );

    
    console.log("Response type:", typeof data);

    console.log(
      "Top-level fields:",
      Object.keys(data || {})
    );

    console.log(
      "First product sample:",
      JSON.stringify(
        data?.list?.[0] ||
        data?.content?.[0] ||
        data?.products?.[0] ||
        data?.[0] ||
        null,
        null,
        2
      )
    );


  } catch (error) {
    console.error(
      "Failed to retrieve CJ products:",
      error.message
    );
  }
}

testCJProducts();

