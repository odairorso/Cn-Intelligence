import 'dotenv/config';
import { sql } from '../api/_db.js';

async function listAllTables() {
  try {
    const rows = await sql`SELECT schemaname, tablename FROM pg_catalog.pg_tables`;
    console.log('All Tables:');
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Error listing tables:', e);
    process.exit(1);
  }
}

listAllTables();
