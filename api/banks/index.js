import { sql, setCors } from '../_db.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      const { uid } = req.query;
      const rows = uid
        ? await sql`SELECT * FROM banks WHERE uid = ${uid} ORDER BY nome ASC`
        : await sql`SELECT * FROM banks ORDER BY nome ASC`;
      return res.json(rows);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { uid, nome, agencia, conta, saldo, ativo } = req.body;
      const rows = await sql`
        INSERT INTO banks (uid, nome, agencia, conta, saldo, ativo)
        VALUES (${uid || 'guest'}, ${nome}, ${agencia || null}, ${conta || null}, ${saldo || 0}, ${ativo !== false})
        RETURNING *`;
      return res.status(201).json(rows[0]);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
