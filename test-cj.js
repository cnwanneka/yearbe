
const { getAccessToken } = require("./services/cjApi");

async function testCJConnection() {
  try {
    await getAccessToken();

    console.log(
      "CJdropshipping API connected successfully!"
    );
  } catch (error) {
    console.error(
      "CJdropshipping connection failed:",
      error.message
    );
  }
}

testCJConnection();
