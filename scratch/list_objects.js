import 'dotenv/config';
import { sql } from '../api/_db.js';

async function listAllObjects() {
  try {
    const rows = await sql`
      SELECT n.nspname as schema, c.relname as name, c.relkind as type
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND c.relkind IN ('r', 'v', 'm')
    `;
    console.log('Objects:');
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

listAllObjects();
