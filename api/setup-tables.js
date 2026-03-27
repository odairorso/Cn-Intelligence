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

      // Add tipo column (RECEITA/DESPESA) to transactions if not exists
      await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tipo VARCHAR(10) DEFAULT 'DESPESA'`;

      // Add juros column to transactions if not exists
      await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS juros NUMERIC DEFAULT 0`;

      // Add numero_boleto column if not exists
      await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS numero_boleto VARCHAR(255)`;

      // Add conta_contabil_id column if not exists
      await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS conta_contabil_id INTEGER REFERENCES contas_contabeis(id)`;

      // Create contas_contabeis table if not exists
      await sql`
        CREATE TABLE IF NOT EXISTS contas_contabeis (
          id SERIAL PRIMARY KEY,
          codigo VARCHAR(20) NOT NULL,
          nome VARCHAR(255) NOT NULL,
          tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('RECEITA', 'DESPESA')),
          ativo BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `;

      // Insert default contas contábeis if empty
      const existing = await sql`SELECT COUNT(*) as cnt FROM contas_contabeis`;
      if (Number(existing[0].cnt) === 0) {
        await sql`
          INSERT INTO contas_contabeis (codigo, nome, tipo) VALUES
          ('3.1', 'Folha de Pagamento', 'DESPESA'),
          ('3.2', 'Aluguel', 'DESPESA'),
          ('3.3', 'Água / Luz / Telefone', 'DESPESA'),
          ('3.4', 'Material de Escritório', 'DESPESA'),
          ('3.5', 'Segurança', 'DESPESA'),
          ('3.6', 'Editoras', 'DESPESA'),
          ('3.7', 'Impostos', 'DESPESA'),
          ('3.8', 'Manutenção', 'DESPESA'),
          ('3.9', 'Outras Despesas', 'DESPESA'),
          ('4.1', 'Mensalidades', 'RECEITA'),
          ('4.2', 'Repasses', 'RECEITA'),
          ('4.3', 'Matrículas', 'RECEITA'),
          ('4.4', 'Permutas / Convênios', 'RECEITA'),
          ('4.5', 'Outras Receitas', 'RECEITA')
        `;
      }

      // Create banks index if not exists
      await sql`CREATE INDEX IF NOT EXISTS idx_banks_uid ON banks(uid)`;

      // Index for fast duplicate detection
      await sql`CREATE INDEX IF NOT EXISTS idx_transactions_duplicate ON transactions(fornecedor, vencimento, valor, empresa)`;

      // Index for fast date queries
      await sql`CREATE INDEX IF NOT EXISTS idx_transactions_vencimento ON transactions(vencimento)`;

      return res.json({ message: 'Tables created successfully' });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
