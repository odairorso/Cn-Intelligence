import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;

const pool = new pg.Pool({
  connectionString: connectionString.replace(/sslmode=[^&?]+/g, 'sslmode=require'),
  ssl: {
    rejectUnauthorized: false
  }
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('Querying details from suppliers table for Schmitz variations (fixed query):');
    
    const res = await client.query(`
      SELECT id, nome, cnpj, email, telefone, uid 
      FROM suppliers 
      WHERE upper(nome) LIKE 'SCHM%'
    `);
    
    console.table(res.rows);

  } catch (err) {
    console.error('Error running query:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
