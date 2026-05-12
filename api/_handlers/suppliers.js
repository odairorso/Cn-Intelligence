import { sql } from '../_db.js';
import { normSupplier } from '../_utils.js';

// GET/POST /api?route=suppliers
export async function handleSuppliers(req, res) {
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
      const nomeTrim = String(nome || '').trim();
      if (!nomeTrim) return res.status(400).json({ error: 'Nome do fornecedor é obrigatório' });

      const normalized = normSupplier(nomeTrim);
      const existing = await sql`
        SELECT * FROM suppliers
        WHERE upper(regexp_replace(coalesce(nome, ''), '[^A-Za-z0-9]+', ' ', 'g')) = ${normalized}
        LIMIT 1`;
      if (existing.length) {
        return res.status(200).json(existing[0]);
      }

      const rows = await sql`
        INSERT INTO suppliers (uid, nome, cnpj, email, telefone)
        VALUES (${uid || 'guest'}, ${nomeTrim}, ${cnpj || null}, ${email || null}, ${telefone || null})
        RETURNING *`;
      return res.status(201).json(rows[0]);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// POST /api?route=suppliers-batch
export async function handleSuppliersBatch(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const suppliers = req.body;
  if (!Array.isArray(suppliers) || suppliers.length === 0) return res.status(400).json({ error: 'Invalid batch data' });

  try {
    for (const sup of suppliers) {
      const { uid, nome, cnpj, email, telefone } = sup;
      const nomeTrim = String(nome || '').trim();
      if (!nomeTrim) continue;
      const normalized = normSupplier(nomeTrim);
      const exists = await sql`
        SELECT id FROM suppliers
        WHERE upper(regexp_replace(coalesce(nome, ''), '[^A-Za-z0-9]+', ' ', 'g')) = ${normalized}
        LIMIT 1`;
      if (exists.length) continue;
      await sql`
        INSERT INTO suppliers (uid, nome, cnpj, email, telefone)
        VALUES (${uid || 'guest'}, ${nomeTrim}, ${cnpj || null}, ${email || null}, ${telefone || null})
        ON CONFLICT DO NOTHING`;
    }
    return res.status(201).json({ message: 'Batch created successfully', count: suppliers.length });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}

// POST /api?route=suppliers-merge
export async function handleSuppliersMerge(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { target, aliases } = req.body || {};
    const canonical = String(target || '').trim();
    const list = Array.isArray(aliases) ? aliases.filter(Boolean).map(String) : [];
    if (!canonical || list.length === 0) return res.status(400).json({ error: 'target e aliases são obrigatórios' });

    const upperTarget = normSupplier(canonical);
    const upperAliases = list.map(normSupplier).filter((v) => v && v !== upperTarget);
    if (upperAliases.length === 0) return res.status(200).json({ updated: 0, removed: 0 });

    const existingTarget = await sql`SELECT id FROM suppliers WHERE upper(regexp_replace(nome, '[^A-Za-z0-9]+', ' ', 'g')) = ${upperTarget} LIMIT 1`;
    if (existingTarget.length === 0) await sql`INSERT INTO suppliers (uid, nome) VALUES ('guest', ${canonical})`;

    for (const alias of upperAliases) {
      await sql`UPDATE transactions SET fornecedor = ${canonical} WHERE upper(regexp_replace(fornecedor, '[^A-Za-z0-9]+', ' ', 'g')) = ${alias}`;
    }
    const cnt = await sql`SELECT COUNT(*)::int AS c FROM transactions WHERE fornecedor = ${canonical}`;
    const updated = Number(cnt[0].c) || 0;

    let removed = 0;
    for (const alias of upperAliases) {
      const rows = await sql`DELETE FROM suppliers WHERE upper(regexp_replace(nome, '[^A-Za-z0-9]+', ' ', 'g')) = ${alias} AND upper(regexp_replace(nome, '[^A-Za-z0-9]+', ' ', 'g')) <> ${upperTarget} RETURNING id`;
      removed += rows.length;
    }
    return res.json({ updated, removed, target: canonical });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// POST /api?route=suppliers-merge-auto
export async function handleSuppliersMergeAuto(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const suppliers = await sql`SELECT id, nome FROM suppliers ORDER BY nome`;
    const txs = await sql`SELECT id, fornecedor FROM transactions`;

    const freqByName = new Map();
    txs.forEach((t) => {
      const name = String(t.fornecedor || '').trim();
      if (!name) return;
      freqByName.set(name, (freqByName.get(name) || 0) + 1);
    });

    const groups = new Map();
    suppliers.forEach((s) => {
      const key = normSupplier(s.nome);
      if (!key) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ id: s.id, nome: s.nome });
    });

    let totalUpdated = 0;
    let totalRemoved = 0;
    let groupsProcessed = 0;

    for (const [key, items] of groups.entries()) {
      if (items.length <= 1) continue;
      groupsProcessed++;
      const names = items.map(i => i.nome);
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
      for (const alias of aliases) {
        const normalizedAlias = normSupplier(alias);
        const updateResult = await sql`UPDATE transactions SET fornecedor = ${canonical} WHERE upper(regexp_replace(coalesce(fornecedor, ''), '[^A-Za-z0-9]+', ' ', 'g')) = ${normalizedAlias} OR fornecedor = ${alias}`;
        totalUpdated += updateResult.length;

        const deleteResult = await sql`DELETE FROM suppliers WHERE (upper(regexp_replace(coalesce(nome, ''), '[^A-Za-z0-9]+', ' ', 'g')) = ${normalizedAlias} OR nome = ${alias}) AND nome != ${canonical} RETURNING id`;
        totalRemoved += deleteResult.length;
      }
    }
    return res.json({ updated: totalUpdated, removed: totalRemoved, groupsProcessed });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// PUT/DELETE /api?route=suppliers&id=xxx
export async function handleSupplierById(req, res) {
  const { id } = req.query;
  if (req.method === 'PUT') {
    try {
      const { nome, cnpj, email, telefone } = req.body;
      const rows = await sql`UPDATE suppliers SET nome = ${nome}, cnpj = ${cnpj}, email = ${email}, telefone = ${telefone}, updated_at = NOW() WHERE id = ${id} RETURNING *`;
      if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
      return res.json(rows[0]);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
  if (req.method === 'DELETE') {
    try {
      await sql`DELETE FROM suppliers WHERE id = ${id}`;
      return res.status(204).end();
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
