import { sql, setCors } from '../_db.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;

  if (req.method === 'PUT') {
    try {
      const { nome, agencia, conta, saldo, ativo } = req.body;
      const rows = await sql`
        UPDATE banks 
        SET nome = COALESCE(${nome}, nome),
            agencia = COALESCE(${agencia}, agencia),
            conta = COALESCE(${conta}, conta),
            saldo = COALESCE(${saldo}, saldo),
            ativo = COALESCE(${ativo}, ativo)
        WHERE id = ${id}
        RETURNING *`;
      return res.json(rows[0]);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await sql`DELETE FROM banks WHERE id = ${id}`;
      return res.status(204).end();
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
