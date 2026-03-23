import { sql, parseDateToPg, setCors } from '../_db.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;

  if (req.method === 'PUT') {
    try {
      const { status, pagamento } = req.body;
      const pDate = parseDateToPg(pagamento);
      const rows = pDate
        ? await sql`UPDATE transactions SET status = ${status}, pagamento = ${pDate} WHERE id = ${id} RETURNING *`
        : await sql`UPDATE transactions SET status = ${status} WHERE id = ${id} RETURNING *`;
      return res.json(rows[0]);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await sql`DELETE FROM transactions WHERE id = ${id}`;
      return res.status(204).end();
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
