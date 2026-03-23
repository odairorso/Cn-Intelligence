import { sql, setCors } from './_db.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const result = await sql`
      DELETE FROM transactions
      WHERE valor > 500000
         OR valor < 0.01
         OR valor IS NULL
         OR valor = 0
         OR fornecedor IS NULL
         OR fornecedor = ''
         OR fornecedor ILIKE '%undefined%'
         OR fornecedor ILIKE '%null%'`;
    return res.json({ deleted: result.length ?? 0 });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
