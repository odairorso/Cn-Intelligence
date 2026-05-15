import 'dotenv/config';
import { sql } from '../api/_db.js';

async function listViews() {
  try {
    const rows = await sql`SELECT schemaname, viewname FROM pg_catalog.pg_views WHERE schemaname = 'public'`;
    console.log('Views:');
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Error listing views:', e);
    process.exit(1);
  }
}

listViews();
