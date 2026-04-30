require('dotenv').config();
const { sql } = require('@vercel/postgres');

async function main() {
  try {
    const { rows } = await sql`SELECT * FROM boleto_patterns ORDER BY id DESC LIMIT 20`;
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) {
    console.error(e);
  }
}
main();
