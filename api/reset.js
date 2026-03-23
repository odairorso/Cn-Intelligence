import { sql, setCors } from './_db.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await sql`TRUNCATE TABLE transactions RESTART IDENTITY CASCADE`;
    await sql`TRUNCATE TABLE suppliers RESTART IDENTITY CASCADE`;
    return res.status(204).end();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
