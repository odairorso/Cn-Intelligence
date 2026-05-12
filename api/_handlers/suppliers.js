import { sql } from '../_db.js';
import { normSupplier } from '../_utils.js';
import { SupplierSchema, SupplierMergeSchema } from '../_schemas.js';

// GET/POST /api?route=suppliers
export async function handleSuppliers(req, res) {
  const uid = req.authUid;

  if (req.method === 'GET') {
    try {
      if (!uid) return res.status(401).json({ error: 'Autenticação necessária' });
      const rows = await sql`SELECT * FROM suppliers WHERE uid = ${uid} ORDER BY nome ASC`;
      return res.json(rows);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    try {
      if (!uid) return res.status(401).json({ error: 'Autenticação necessária' });

      const result = SupplierSchema.safeParse({ ...(req.body || {}), uid });
      if (!result.success) {
        return res.status(400).json({ error: 'Dados inválidos', details: result.error.flatten().fieldErrors });
      }

      const { nome, cnpj, email, telefone } = result.data;
      const nomeTrim = String(nome || '').trim();

      const normalized = normSupplier(nomeTrim);
      const existing = await sql`
        SELECT * FROM suppliers
        WHERE uid = ${uid}
        AND upper(regexp_replace(coalesce(nome, ''), '[^A-Za-z0-9]+', ' ', 'g')) = ${normalized}
        LIMIT 1`;
      if (existing.length) {
        return res.status(200).json(existing[0]);
      }

      const rows = await sql`
        INSERT INTO suppliers (uid, nome, cnpj, email, telefone)
        VALUES (${uid}, ${nomeTrim}, ${cnpj || null}, ${email || null}, ${telefone || null})
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

  const uid = req.authUid;
  if (!uid) return res.status(401).json({ error: 'Autenticação necessária' });

  const suppliers = req.body;
  if (!Array.isArray(suppliers) || suppliers.length === 0) return res.status(400).json({ error: 'Invalid batch data' });

  try {
    for (const sup of suppliers) {
      const result = SupplierSchema.safeParse({ ...(sup || {}), uid });
      if (!result.success) continue;

      const { nome, cnpj, email, telefone } = result.data;
      const nomeTrim = String(nome || '').trim();
      if (!nomeTrim) continue;

      const normalized = normSupplier(nomeTrim);
      const exists = await sql`
        SELECT id FROM suppliers
        WHERE uid = ${uid}
        AND upper(regexp_replace(coalesce(nome, ''), '[^A-Za-z0-9]+', ' ', 'g')) = ${normalized}
        LIMIT 1`;
      if (exists.length) continue;

      await sql`
        INSERT INTO suppliers (uid, nome, cnpj, email, telefone)
        VALUES (${uid}, ${nomeTrim}, ${cnpj || null}, ${email || null}, ${telefone || null})
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

  const uid = req.authUid;

  try {
    if (!uid) return res.status(401).json({ error: 'Autenticação necessária' });

    const result = SupplierMergeSchema.safeParse({ ...(req.body || {}), uid });
    if (!result.success) {
      return res.status(400).json({ error: 'Dados inválidos', details: result.error.flatten().fieldErrors });
    }

    const { target, aliases } = result.data;
    const canonical = String(target || '').trim();
    const list = Array.isArray(aliases) ? aliases.filter(Boolean).map(String) : [];
    if (!canonical || list.length === 0) return res.status(400).json({ error: 'target e aliases são obrigatórios' });

    const upperTarget = normSupplier(canonical);
    const upperAliases = list.map(normSupplier).filter((v) => v && v !== upperTarget);
    if (upperAliases.length === 0) return res.status(200).json({ updated: 0, removed: 0 });

    const existingTarget = await sql`SELECT id FROM suppliers WHERE uid = ${uid} AND upper(regexp_replace(nome, '[^A-Za-z0-9]+', ' ', 'g')) = ${upperTarget} LIMIT 1`;
    if (existingTarget.length === 0) await sql`INSERT INTO suppliers (uid, nome) VALUES (${uid}, ${canonical})`;

    for (const alias of upperAliases) {
      await sql`UPDATE transactions SET fornecedor = ${canonical}, updated_at = NOW() WHERE uid = ${uid} AND upper(regexp_replace(fornecedor, '[^A-Za-z0-9]+', ' ', 'g')) = ${alias}`;
    }
    const cnt = await sql`SELECT COUNT(*)::int AS c FROM transactions WHERE uid = ${uid} AND fornecedor = ${canonical}`;
    const updated = Number(cnt[0].c) || 0;

    let removed = 0;
    for (const alias of upperAliases) {
      const rows = await sql`DELETE FROM suppliers WHERE uid = ${uid} AND upper(regexp_replace(nome, '[^A-Za-z0-9]+', ' ', 'g')) = ${alias} AND upper(regexp_replace(nome, '[^A-Za-z0-9]+', ' ', 'g')) <> ${upperTarget} RETURNING id`;
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

  const uid = req.authUid;

  try {
    if (!uid) return res.status(401).json({ error: 'Autenticação necessária' });

    const suppliers = await sql`SELECT id, nome FROM suppliers WHERE uid = ${uid} ORDER BY nome`;
    const txs = await sql`SELECT id, fornecedor FROM transactions WHERE uid = ${uid}`;

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

    for (const [key, items] of groups.entries()) {
      if (items.length <= 1) continue;
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
        await sql`UPDATE transactions SET fornecedor = ${canonical}, updated_at = NOW() WHERE uid = ${uid} AND (upper(regexp_replace(coalesce(fornecedor, ''), '[^A-Za-z0-9]+', ' ', 'g')) = ${normalizedAlias} OR fornecedor = ${alias})`;
        totalUpdated++;

        const deleteResult = await sql`DELETE FROM suppliers WHERE uid = ${uid} AND (upper(regexp_replace(coalesce(nome, ''), '[^A-Za-z0-9]+', ' ', 'g')) = ${normalizedAlias} OR nome = ${alias}) AND nome != ${canonical} RETURNING id`;
        totalRemoved += deleteResult.length;
      }
    }
    return res.json({ updated: totalUpdated, removed: totalRemoved });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// PUT/DELETE /api?route=suppliers&id=xxx
export async function handleSupplierById(req, res) {
  const uid = req.authUid;

  const { id } = req.query;
  if (req.method === 'PUT') {
    try {
      if (!uid) return res.status(401).json({ error: 'Autenticação necessária' });

      const result = SupplierSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: 'Dados inválidos', details: result.error.flatten().fieldErrors });
      }

      const { nome, cnpj, email, telefone } = result.data;

      // Verificar propriedade
      const existing = await sql`SELECT id FROM suppliers WHERE id = ${id} AND uid = ${uid}`;
      if (existing.length === 0) return res.status(404).json({ error: 'Not found' });

      const rows = await sql`UPDATE suppliers SET nome = COALESCE(${nome}, nome), cnpj = COALESCE(${cnpj}, cnpj), email = COALESCE(${email || null}, email), telefone = COALESCE(${telefone || null}, telefone), updated_at = NOW() WHERE id = ${id} AND uid = ${uid} RETURNING *`;
      if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
      return res.json(rows[0]);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
  if (req.method === 'DELETE') {
    try {
      if (!uid) return res.status(401).json({ error: 'Autenticação necessária' });
      const existing = await sql`SELECT id FROM suppliers WHERE id = ${id} AND uid = ${uid}`;
      if (existing.length === 0) return res.status(404).json({ error: 'Not found' });
      await sql`DELETE FROM suppliers WHERE id = ${id} AND uid = ${uid}`;
      return res.status(204).end();
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
