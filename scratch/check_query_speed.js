import pg from 'pg';
import { config } from 'dotenv';
config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  const client = await pool.connect();
  try {
    console.log("Fetching distinct UIDs in database...");
    const uidRes = await client.query("SELECT uid, COUNT(*) FROM transactions GROUP BY uid");
    console.table(uidRes.rows);
    
    if (uidRes.rows.length === 0) {
      console.log("No transactions in database!");
      return;
    }
    
    const realUid = uidRes.rows[0].uid;
    console.log(`Using real UID: '${realUid}' for speed test...`);
    
    const start = Date.now();
    const res = await client.query({
      text: `SELECT * FROM transactions 
             WHERE (uid = $1 OR uid IS NULL) AND deleted_at IS NULL 
             ORDER BY vencimento DESC 
             LIMIT 100 OFFSET 0`,
      values: [realUid]
    });
    const end = Date.now();
    console.log(`Query completed in ${end - start}ms. Returned ${res.rows.length} rows.`);

    const searchStart = Date.now();
    const searchRes = await client.query({
      text: `SELECT * FROM transactions 
             WHERE (uid = $1 OR uid IS NULL) AND deleted_at IS NULL 
               AND (unaccent(fornecedor) ILIKE unaccent('%RECEITA%'))
             ORDER BY vencimento DESC 
             LIMIT 100 OFFSET 0`,
      values: [realUid]
    });
    const searchEnd = Date.now();
    console.log(`Search query completed in ${searchEnd - searchStart}ms. Returned ${searchRes.rows.length} rows.`);
    
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

main();
