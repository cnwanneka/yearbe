
const pool = require("./database/db");

async function testDatabase() {
  try {
    const result = await pool.query(
      "SELECT current_database()"
    );

    console.log(
      "Database connected successfully:",
      result.rows[0].current_database
    );
  } catch (error) {
    console.error("Connection failed:", error.message);
  } finally {
    await pool.end();
  }
}

testDatabase();
