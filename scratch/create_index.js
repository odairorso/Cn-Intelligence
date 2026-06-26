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
  const client = pool;
  try {
    console.log('Creating composite index for optimized transaction fetch...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_uid_vencimento_active 
      ON transactions(uid, vencimento DESC) 
      WHERE deleted_at IS NULL;
    `);
    console.log('Index created successfully!');

    console.log('\nRunning EXPLAIN ANALYZE on transactions fetch query...');
    const uid = 'odair';
    const explainRes = await client.query(
      `EXPLAIN ANALYZE SELECT * FROM transactions WHERE (uid = $1 OR uid IS NULL) AND deleted_at IS NULL ORDER BY vencimento DESC LIMIT 100 OFFSET 0`,
      [uid]
    );
    console.log(explainRes.rows.map(r => r['QUERY PLAN']).join('\n'));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
