
import dotenv from 'dotenv';
dotenv.config();

// Agora importamos o sql, depois que o env já carregou
const { sql } = await import('../api/_db.js');

async function test() {
  try {
    const rows = await sql`SELECT COUNT(*) as total FROM transactions`;
    console.log('Successfully connected to Supabase!');
    console.log('Total transactions in Supabase:', rows[0].total);
  } catch (err) {
    console.error('Database connection test failed:', err);
  }
}

test();
