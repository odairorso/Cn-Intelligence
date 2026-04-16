const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function checkSchema() {
  try {
    const res = await sql`
      SELECT column_name, is_nullable, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'transactions'
    `;
    console.log('--- SCHEMA ---');
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.error(e);
  }
}

checkSchema();
