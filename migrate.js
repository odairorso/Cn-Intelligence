import { config } from 'dotenv';
import pg from 'pg';
config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS banks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        uid VARCHAR(255) NOT NULL,
        nome VARCHAR(255) NOT NULL,
        saldo DECIMAL(15,2) DEFAULT 0,
        ativo BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Add banco column to transactions if it doesn't exist
    await pool.query(`
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS banco VARCHAR(255);
    `);

    // Fix the 2026 bug for recently created transactions
    await pool.query(`
      UPDATE transactions 
      SET 
        vencimento = vencimento - INTERVAL '2 years',
        pagamento = pagamento - INTERVAL '2 years'
      WHERE EXTRACT(YEAR FROM vencimento) = 2026 
        AND created_at >= CURRENT_DATE - INTERVAL '1 day';
    `);

    console.log("Migration and data fix successful!");
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
migrate();
