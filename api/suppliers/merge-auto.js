import { sql, setCors } from '../_db.js';

const norm = (s) => String(s || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, ' ')
  .trim();

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const suppliers = await sql`SELECT id, nome FROM suppliers`;
    const txs = await sql`SELECT fornecedor FROM transactions`;

    const freqByName = new Map(); // original name -> count
    txs.forEach((t) => {
      const name = String(t.fornecedor || '').trim();
      if (!name) return;
      freqByName.set(name, (freqByName.get(name) || 0) + 1);
    });

    const groups = new Map(); // normalized -> Set(names)
    suppliers.forEach((s) => {
      const key = norm(s.nome);
      if (!key) return;
      if (!groups.has(key)) groups.set(key, new Set());
      groups.get(key).add(s.nome);
    });

    let totalUpdated = 0;
    let totalRemoved = 0;

    for (const [key, set] of groups.entries()) {
      const names = Array.from(set.values());
      if (names.length <= 1) continue;
      // Choose canonical by highest transaction frequency; fallback to longest name
      let canonical = names[0];
      let bestScore = -1;
      names.forEach((n) => {
        const score = freqByName.get(n) || 0;
        if (score > bestScore || (score === bestScore && n.length > canonical.length)) {
          bestScore = score;
          canonical = n;
        }
      });

      const aliases = names.filter((n) => n !== canonical);
      if (aliases.length === 0) continue;

      // Update transactions
      for (const alias of aliases) {
        await sql`UPDATE transactions SET fornecedor = ${canonical} WHERE upper(regexp_replace(fornecedor, '[^A-Za-z0-9]+', ' ', 'g')) = ${norm(alias)}`;
      }
      const cnt = await sql`SELECT COUNT(*)::int AS c FROM transactions WHERE fornecedor = ${canonical}`;
      totalUpdated += Number(cnt[0].c) || 0;

      // Remove supplier duplicates
      for (const alias of aliases) {
        const rows = await sql`DELETE FROM suppliers WHERE upper(regexp_replace(nome, '[^A-Za-z0-9]+', ' ', 'g')) = ${norm(alias)} AND upper(regexp_replace(nome, '[^A-Za-z0-9]+', ' ', 'g')) <> ${norm(canonical)} RETURNING id`;
        totalRemoved += rows.length;
      }
    }

    return res.json({ updated: totalUpdated, removed: totalRemoved });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}

