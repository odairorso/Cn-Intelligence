
import dotenv from 'dotenv';
dotenv.config();
const { sql } = await import('../api/_db.js');

async function checkColumns() {
  try {
    const res = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'transactions'
    `;
    console.log('Columns in transactions:', res);
  } catch (err) {
    console.error('Check columns failed:', err);
  }
}

checkColumns();
