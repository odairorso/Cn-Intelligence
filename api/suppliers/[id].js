import pool from './db';

export default async function handler(req, res) {
  if (req.method === 'DELETE') {
    const { id, uid } = req.query;
    try {
      const result = await pool.query(
        'DELETE FROM suppliers WHERE id = $1 AND uid = $2 RETURNING id',
        [id, uid]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Fornecedor não encontrado' });
      }
      return res.status(200).json({ message: 'Excluído com sucesso' });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
