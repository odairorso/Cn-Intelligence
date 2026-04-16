import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

const sql = neon(process.env.DATABASE_URL);

async function check() {
  try {
    const res = await sql`SELECT COUNT(*) FROM transactions`;
    console.log('Total transactions in DB:', res[0].count);
    
    const limitTest = await sql`SELECT * FROM transactions LIMIT 500`;
    console.log('Test SELECT * LIMIT 500 results length:', limitTest.length);
  } catch (e) {
    console.error(e);
  }
}

check();
