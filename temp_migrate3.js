import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log("Tentando criar tabela banks...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS banks (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID,
          uid VARCHAR(255) NOT NULL,
          nome VARCHAR(255) NOT NULL,
          saldo DECIMAL(15, 2) DEFAULT 0,
          ativo BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log("-> Tabela banks criada ou já existe.");
    
    console.log("Adicionando indices...");
    try { await client.query(`CREATE INDEX IF NOT EXISTS idx_banks_uid ON banks(uid);`); } catch(e) { console.log("Erro idx_banks_uid", e.message); }
    try { await client.query(`CREATE INDEX IF NOT EXISTS idx_banks_user_id ON banks(user_id);`); } catch(e) { console.log("Erro idx_banks_user_id", e.message); }

    console.log("Adicionando banco em transactions...");
    try {
      await client.query(`
        ALTER TABLE transactions 
        ADD COLUMN IF NOT EXISTS banco VARCHAR(255);
      `);
      console.log("-> Coluna banco adicionada ou já existe.");
    } catch(e) {
      console.log("Erro ao add banco:", e.message);
    }
    
  } catch (err) {
    console.error('Erro geral na migração:', err.message);
  } finally {
    client.release();
    pool.end();
    process.exit(0);
  }
}

runMigration();
