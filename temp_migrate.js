import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    const client = await pool.connect();
    const sqlPath = path.join(__dirname, 'sql', 'setup_neon.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Executando setup_neon.sql...');
    await client.query(sql);
    
    console.log('Tabelas criadas com sucesso!');
    client.release();
  } catch (err) {
    console.error('Erro na migração:', err);
  } finally {
    pool.end();
  }
}

runMigration();
