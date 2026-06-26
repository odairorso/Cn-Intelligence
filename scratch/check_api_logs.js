import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL || process.env.URL_DO_BANCO_DE_DADOS || process.env.DATABASE_URLL;

if (!connectionString) {
  console.error('DATABASE_URL is not defined in .env');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: connectionString.replace(/sslmode=[^&?]+/g, 'sslmode=require'),
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  try {
    let countApiLogs = 0;
    let hasTable = false;
    try {
      const res = await client.query("SELECT COUNT(*) FROM api_logs");
      countApiLogs = res.rows[0].count;
      hasTable = true;
    } catch (e) {
      console.log('No api_logs table exists:', e.message);
    }

    if (hasTable) {
      console.log('api_logs count:', countApiLogs);
      
      // Get table size in bytes
      const sizeRes = await client.query("SELECT pg_size_pretty(pg_total_relation_size('api_logs')) as size");
      console.log('api_logs disk size:', sizeRes.rows[0].size);
      
      // Let's check when the oldest log is
      const oldestRes = await client.query("SELECT MIN(created_at) as oldest, MAX(created_at) as newest FROM api_logs");
      console.log('Oldest log:', oldestRes.rows[0].oldest);
      console.log('Newest log:', oldestRes.rows[0].newest);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
