import { sql, setCors } from './_db.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    try {
      // Create banks table if not exists
      await sql`
        CREATE TABLE IF NOT EXISTS banks (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          uid VARCHAR(255) NOT NULL,
          nome VARCHAR(255) NOT NULL,
          agencia VARCHAR(100),
          conta VARCHAR(100),
          saldo DECIMAL(15, 2) DEFAULT 0,
          ativo BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `;

      await sql`ALTER TABLE banks ADD COLUMN IF NOT EXISTS agencia VARCHAR(100)`;
      await sql`ALTER TABLE banks ADD COLUMN IF NOT EXISTS conta VARCHAR(100)`;

      // Add banco column to transactions if not exists
      await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS banco VARCHAR(255)`;

      // Create banks index if not exists
      await sql`CREATE INDEX IF NOT EXISTS idx_banks_uid ON banks(uid)`;

      return res.json({ message: 'Tables created successfully' });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
