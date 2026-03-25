import { sql, parseDateToPg, setCors } from '../_db.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const transactions = req.body;
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return res.status(400).json({ error: 'Invalid batch data' });
  }

  try {
    for (const tx of transactions) {
      const { uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco } = tx;
      const vDate = parseDateToPg(vencimento) || new Date().toISOString().split('T')[0];
      const pDate = parseDateToPg(pagamento);
      await sql`
        INSERT INTO transactions (uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco)
        VALUES (${uid || 'guest'}, ${fornecedor}, ${descricao || '-'}, ${empresa || 'Geral'},
                ${vDate}, ${pDate}, ${valor}, ${status || 'PENDENTE'}, ${banco || null})`;
    }
    return res.status(201).json({ message: 'Batch created successfully', count: transactions.length });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
