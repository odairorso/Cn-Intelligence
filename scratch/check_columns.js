import 'dotenv/config';
import { sql } from '../api/_db.js';

async function checkColumns() {
  try {
    const rows = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'security_audit'`;
    console.log('Columns:');
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

checkColumns();
