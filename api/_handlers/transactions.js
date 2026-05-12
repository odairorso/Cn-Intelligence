import { sql, parseDateToPg } from '../_db.js';
import { normalizeBoletoNumber, sanitizeObject } from '../_utils.js';

// GET /api?route=transactions
export async function handleTransactions(req, res) {
  if (req.method === 'GET') {
    try {
      const { uid, limit, offset, year, month, search, tipo, empresa, status, conta_contabil_id } = req.query;
      
      if (!uid || uid === 'undefined' || uid === 'null') {
        return res.status(401).json({ error: 'Identificação de usuário (UID) obrigatória para esta operação.' });
      }

      const defaultLimit = 100;
      const parsedLimit = limit ? parseInt(limit) : defaultLimit;
      const parsedOffset = offset ? parseInt(offset) : 0;

      let query = sql`SELECT * FROM transactions WHERE 1=1`;
      if (uid) query = sql`${query} AND uid = ${uid}`;
      if (tipo && tipo !== 'TODOS') query = sql`${query} AND tipo = ${tipo}`;
      if (empresa && empresa !== 'TODOS') query = sql`${query} AND upper(empresa) = upper(${empresa})`;
      if (status && status !== 'TODOS') {
        if (status === 'NAO_PAGO') query = sql`${query} AND (status = 'PENDENTE' OR status = 'VENCIDO')`;
        else query = sql`${query} AND status = ${status}`;
      }
      if (conta_contabil_id) {
        const ccid = parseInt(String(conta_contabil_id));
        if (Number.isFinite(ccid)) query = sql`${query} AND conta_contabil_id = ${ccid}`;
      }

      if (search) {
        const parseSearchMoney = (input) => {
          const raw = String(input || '').trim();
          if (!raw) return null;
          const cleaned = raw.replace(/[^\d,.\-]/g, '');
          if (!cleaned) return null;
          let n;
          if (cleaned.includes(',') && cleaned.includes('.')) {
            const lastComma = cleaned.lastIndexOf(',');
            const lastDot = cleaned.lastIndexOf('.');
            if (lastComma > lastDot) n = Number(cleaned.replace(/\./g, '').replace(',', '.'));
            else n = Number(cleaned.replace(/,/g, ''));
          } else if (cleaned.includes(',')) {
            n = Number(cleaned.replace(/\./g, '').replace(',', '.'));
          } else {
            n = Number(cleaned);
          }
          return Number.isFinite(n) ? n : null;
        };

        const money = parseSearchMoney(search);
        const s = `%${search.replace(/[^\d]/g, '')}%`;
        const sRaw = `%${search}%`;
        
        query = sql`${query} AND (
          fornecedor ILIKE ${sRaw}
          OR descricao ILIKE ${sRaw}
          OR empresa ILIKE ${sRaw}
          OR CAST(valor AS TEXT) ILIKE ${sRaw}
          OR REPLACE(CAST(valor AS TEXT), '.', '') ILIKE ${s}
          OR REPLACE(REPLACE(CAST(valor AS TEXT), '.', ''), ',', '') ILIKE ${s}
          ${money !== null ? sql`OR abs(valor - ${money}) < 0.01 OR abs((valor + coalesce(juros, 0)) - ${money}) < 0.01` : sql``}
        )`;
      } else {
        if (year && year !== 'TODOS') {
          const start = `${year}-01-01`;
          const end = `${year}-12-31`;
          query = sql`${query} AND vencimento >= ${start} AND vencimento <= ${end}`;
        }
        if (month && month !== 'TODOS') {
          const m = month.padStart(2, '0');
          query = sql`${query} AND TO_CHAR(vencimento, 'MM') = ${m}`;
        }
      }

      const rows = await sql`${query} ORDER BY vencimento DESC LIMIT ${parsedLimit} OFFSET ${parsedOffset}`;

      const formatted = rows.map(tx => ({
        ...tx,
        vencimento: tx.vencimento ? new Date(tx.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '',
        pagamento: tx.pagamento ? new Date(tx.pagamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : undefined,
        valor: Number(tx.valor),
        juros: Number(tx.juros || 0),
      }));
      return res.json(formatted);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco, tipo, numero_boleto, conta_contabil_id } = req.body;
      try { await sql`ALTER TABLE transactions ALTER COLUMN tipo TYPE VARCHAR(20)`; } catch {}
      const vDate = parseDateToPg(vencimento);
      const pDate = parseDateToPg(pagamento);
      const normalizedNumber = normalizeBoletoNumber(numero_boleto);
      const valorNumber = Number(valor);
      if (!Number.isFinite(valorNumber)) {
        return res.status(400).json({ error: 'Valor inválido' });
      }
      const tipoSafe = typeof tipo === 'string' && tipo.trim() ? tipo.trim() : 'DESPESA';
      const duplicateRows = normalizedNumber
        ? await sql`
            SELECT id FROM transactions
            WHERE regexp_replace(upper(coalesce(numero_boleto, '')), '[^A-Z0-9]', '', 'g') = ${normalizedNumber}
            LIMIT 1`
        : await sql`
            SELECT id FROM transactions
            WHERE upper(coalesce(fornecedor, '')) = upper(${fornecedor})
              AND vencimento = ${vDate}
              AND abs(valor - ${valorNumber}) < 0.0001
              AND upper(coalesce(descricao, '')) = upper(${descricao || ''})
              AND upper(coalesce(empresa, '')) = upper(${empresa || ''})
            LIMIT 1`;
      if (duplicateRows.length) {
        return res.status(409).json({ error: 'Boleto já lançado', duplicate: true });
      }
      const rows = await sql`
        INSERT INTO transactions (uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco, tipo, numero_boleto, conta_contabil_id)
        VALUES (${uid || 'guest'}, ${fornecedor}, ${descricao || '-'}, ${empresa || 'Geral'},
                ${vDate}, ${pDate}, ${valorNumber}, ${status || 'PENDENTE'}, ${banco || null}, ${tipoSafe}, ${normalizedNumber || null}, ${conta_contabil_id || null})
        RETURNING *`;
      return res.status(201).json(rows[0]);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// GET/PUT/DELETE /api?route=transactions&id=...
export async function handleTransactionById(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'ID missing' });

  if (req.method === 'GET') {
    try {
      const rows = await sql`SELECT * FROM transactions WHERE id = ${id}`;
      if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
      const tx = rows[0];
      return res.json({
        ...tx,
        vencimento: tx.vencimento ? new Date(tx.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '',
        pagamento: tx.pagamento ? new Date(tx.pagamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : undefined,
        valor: Number(tx.valor),
        juros: Number(tx.juros || 0),
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco, juros, tipo, numero_boleto, conta_contabil_id } = req.body;
      const vDate = parseDateToPg(vencimento);
      const pDate = parseDateToPg(pagamento);
      const rows = await sql`
        UPDATE transactions
        SET fornecedor = ${fornecedor}, descricao = ${descricao}, empresa = ${empresa},
            vencimento = ${vDate}, pagamento = ${pDate}, valor = ${Number(valor)},
            status = ${status}, banco = ${banco}, juros = ${Number(juros || 0)},
            tipo = ${tipo || 'DESPESA'}, numero_boleto = ${numero_boleto || null},
            conta_contabil_id = ${conta_contabil_id || null},
            updated_at = NOW()
        WHERE id = ${id}
        RETURNING *`;
      if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
      return res.json(rows[0]);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const rows = await sql`DELETE FROM transactions WHERE id = ${id} RETURNING *`;
      if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
      return res.json({ message: 'Deleted' });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// POST /api?route=transactions-batch
export async function handleTransactionsBatch(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const transactions = req.body;
  if (!Array.isArray(transactions) || transactions.length === 0) return res.status(400).json({ error: 'Invalid batch data' });

  try {
    let created = 0;
    let blocked = 0;
    let errors = [];
    const seenKeys = new Set();
    try { await sql`ALTER TABLE transactions ALTER COLUMN tipo TYPE VARCHAR(20)`; } catch {}

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      const { uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco, tipo, numero_boleto, conta_contabil_id } = tx;

      const valorNumber = Number(valor);
      if (!fornecedor || !vencimento || valor === undefined || valor === null || !Number.isFinite(valorNumber)) {
        errors.push({ index: i, error: 'Missing required fields' });
        continue;
      }

      const vDate = parseDateToPg(vencimento) || new Date().toISOString().split('T')[0];
      const pDate = parseDateToPg(pagamento);
      const normalizedNumber = normalizeBoletoNumber(numero_boleto);
      const tipoSafe = typeof tipo === 'string' && tipo.trim() ? tipo.trim() : 'DESPESA';

      const descKey = String(descricao || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const empKey = String(empresa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const localKey = normalizedNumber
        ? `BOLETO:${normalizedNumber}`
        : `BASE:${String(fornecedor || '').toUpperCase()}|${vDate}|${Number(valorNumber || 0).toFixed(2)}|${descKey}|${empKey}`;

      if (seenKeys.has(localKey)) {
        blocked++;
        continue;
      }

      let duplicateRows = normalizedNumber
        ? await sql`SELECT id FROM transactions WHERE regexp_replace(upper(coalesce(numero_boleto, '')), '[^A-Z0-9]', '', 'g') = ${normalizedNumber} LIMIT 1`
        : await sql`SELECT id FROM transactions WHERE upper(coalesce(fornecedor, '')) = upper(${fornecedor}) AND vencimento = ${vDate} AND abs(valor - ${valorNumber}) < 0.0001 AND upper(coalesce(descricao, '')) = upper(${descricao || ''}) AND upper(coalesce(empresa, '')) = upper(${empresa || ''}) LIMIT 1`;

      if (duplicateRows.length) {
        blocked++;
        continue;
      }

      try {
        await sql`INSERT INTO transactions (uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco, tipo, numero_boleto, conta_contabil_id) VALUES (${uid || 'guest'}, ${fornecedor}, ${descricao || '-'}, ${empresa || 'Geral'}, ${vDate}, ${pDate}, ${valorNumber}, ${status || 'PENDENTE'}, ${banco || null}, ${tipoSafe}, ${normalizedNumber || null}, ${conta_contabil_id || null})`;
        created++;
      } catch (rowError) {
        errors.push({ index: i, error: rowError.message });
      }
      seenKeys.add(localKey);
    }
    return res.status(201).json({ message: 'Batch processed', count: created, blocked, errors });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// PUT /api?route=transactions-batch-update
export async function handleTransactionsBatchUpdate(req, res) {
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });
  const { ids, banco, dataPagamento } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'IDs missing' });

  try {
    const pDate = parseDateToPg(dataPagamento);
    await sql`UPDATE transactions SET status = 'PAGO', banco = ${banco}, pagamento = ${pDate}, updated_at = NOW() WHERE id IN (${ids})`;
    return res.json({ message: 'Updated successfully' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// DELETE /api?route=transactions-dedupe-movimentos
export async function handleTransactionsDedupeMovimentos(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const rows = await sql`
      WITH duplicates AS (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY uid, fornecedor, vencimento, valor, upper(coalesce(descricao, '')), upper(coalesce(empresa, ''))
          ORDER BY created_at DESC
        ) as row_num
        FROM transactions
        WHERE status = 'PAGO'
      )
      DELETE FROM transactions WHERE id IN (SELECT id FROM duplicates WHERE row_num > 1) RETURNING *`;
    return res.json({ message: 'Deduplicated', count: rows.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// POST /api?route=fix-receitas-tipo
export async function handleFixReceitasTipo(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const result = await sql`
      UPDATE transactions
      SET tipo = 'RECEITA'
      WHERE tipo != 'RECEITA'
        AND (
          descricao ILIKE '%REPASSE%'
          OR descricao ILIKE '%RECEITA%'
          OR descricao ILIKE '%RECEBIMENTO%'
          OR fornecedor ILIKE '%EDUCBANK%'
          OR fornecedor ILIKE '%KROTON%'
        )
    `;
    return res.json({ ok: true, updated: result.count || 0 });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
