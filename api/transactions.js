import pool from './db';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { uid } = req.query;
    try {
      const result = await pool.query(
        'SELECT * FROM transactions WHERE uid = $1 ORDER BY vencimento DESC',
        [uid]
      );
      return res.status(200).json(result.rows);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'POST') {
    const { uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status } = req.body;
    try {
      const result = await pool.query(
        `INSERT INTO transactions (uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status]
      );
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
