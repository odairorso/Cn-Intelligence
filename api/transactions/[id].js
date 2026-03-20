import pool from './db';

export default async function handler(req, res) {
  if (req.method === 'PUT') {
    const { id, uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status } = req.body;
    try {
      const result = await pool.query(
        `UPDATE transactions SET fornecedor = $1, descricao = $2, empresa = $3, 
         vencimento = $4, pagamento = $5, valor = $6, status = $7 WHERE id = $8 AND uid = $9 RETURNING *`,
        [fornecedor, descricao, empresa, vencimento, pagamento, valor, status, id, uid]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Transação não encontrada' });
      }
      return res.status(200).json(result.rows[0]);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'DELETE') {
    const { id, uid } = req.query;
    try {
      const result = await pool.query(
        'DELETE FROM transactions WHERE id = $1 AND uid = $2 RETURNING id',
        [id, uid]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Transação não encontrada' });
      }
      return res.status(200).json({ message: 'Excluído com sucesso' });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
