import { sql, setCors } from './_db.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const result = await sql`
      DELETE FROM transactions
      WHERE ctid IN (
        SELECT ctid FROM (
          SELECT ctid, ROW_NUMBER() OVER (
            PARTITION BY fornecedor, vencimento::text, valor, empresa
            ORDER BY ctid
          ) as rn
          FROM transactions
        ) t
        WHERE rn > 1
      )`;
    return res.json({ deleted: result.length ?? 0 });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
