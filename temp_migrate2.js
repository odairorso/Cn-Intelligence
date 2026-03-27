import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    const client = await pool.connect();
    
    console.log("Iniciando setup exclusivo de Bancos...");
    // Create banks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS banks (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          uid VARCHAR(255) NOT NULL,
          nome VARCHAR(255) NOT NULL,
          saldo DECIMAL(15, 2) DEFAULT 0,
          ativo BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_banks_uid ON banks(uid);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_banks_user_id ON banks(user_id);`);

    // Add banco column to transactions if not exists
    console.log("Adicionando coluna banco em transactions...");
    await client.query(`
      ALTER TABLE transactions 
      ADD COLUMN IF NOT EXISTS banco VARCHAR(255);
    `);
    
    console.log('Tabelas e colunas de bancos criadas com sucesso!');
    client.release();
  } catch (err) {
    console.error('Erro na migração:', err);
  } finally {
    pool.end();
    process.exit(0);
  }
}

runMigration();
