import pool from './db';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { uid } = req.query;
    try {
      const result = await pool.query(
        'SELECT * FROM suppliers WHERE uid = $1 ORDER BY nome',
        [uid]
      );
      return res.status(200).json(result.rows);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'POST') {
    const { uid, nome, cnpj, email, telefone } = req.body;
    try {
      const result = await pool.query(
        `INSERT INTO suppliers (uid, nome, cnpj, email, telefone) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [uid, nome, cnpj, email, telefone]
      );
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
