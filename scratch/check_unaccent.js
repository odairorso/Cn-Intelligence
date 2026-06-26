import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL || process.env.URL_DO_BANCO_DE_DADOS || process.env.DATABASE_URLL;

console.log('Testing connection string:', connectionString ? 'Defined (length: ' + connectionString.length + ')' : 'NOT DEFINED');

if (!connectionString) {
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: connectionString.replace(/sslmode=[^&?]+/g, 'sslmode=require'),
  ssl: {
    rejectUnauthorized: false
  }
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('Connected to database. Trying to enable unaccent extension...');
    await client.query('CREATE EXTENSION IF NOT EXISTS unaccent;');
    console.log('Extension unaccent is enabled! Testing unaccent function...');
    
    const res = await client.query("SELECT unaccent('CLÍNICA DO TRABALHO') AS test1, unaccent('Ações e Serviços') AS test2");
    console.log('Result:', res.rows[0]);
  } catch (err) {
    console.error('Error running test:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
