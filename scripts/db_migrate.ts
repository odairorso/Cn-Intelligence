import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const client = new Client(process.env.DATABASE_URL);
  await client.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS banks (
      id BIGSERIAL PRIMARY KEY,
      uid TEXT,
      nome TEXT NOT NULL,
      agencia TEXT,
      conta TEXT,
      saldo NUMERIC(14,2) DEFAULT 0,
      ativo BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    )`);

    await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS banco TEXT`);

    const res = await client.query(`SELECT COUNT(*) AS c FROM banks`);
    console.log(res.rows);
  } finally {
    await client.end();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
