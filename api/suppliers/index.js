import { sql, setCors } from '../_db.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      const { uid } = req.query;
      const rows = uid
        ? await sql`SELECT * FROM suppliers WHERE uid = ${uid} ORDER BY nome ASC`
        : await sql`SELECT * FROM suppliers ORDER BY nome ASC`;
      return res.json(rows);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { uid, nome, cnpj, email, telefone } = req.body;
      const rows = await sql`
        INSERT INTO suppliers (uid, nome, cnpj, email, telefone)
        VALUES (${uid || 'guest'}, ${nome}, ${cnpj || null}, ${email || null}, ${telefone || null})
        RETURNING *`;
      return res.status(201).json(rows[0]);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
