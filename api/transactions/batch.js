import { sql, parseDateToPg, setCors } from '../_db.js';

const normalizeBoletoNumber = (value) => {
  const raw = String(value || '').toUpperCase();
  if (!raw) return '';
  const tokens = raw
    .split(/[\s:;|,]+/)
    .map((token) => token.replace(/[^A-Z0-9]/g, ''))
    .filter(Boolean);
  const bestToken = tokens.find((token) => /\d{4,}/.test(token) && token.length >= 6 && token.length <= 30);
  if (bestToken) return bestToken;
  return raw.replace(/[^A-Z0-9]/g, '');
};

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const transactions = req.body;
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return res.status(400).json({ error: 'Invalid batch data' });
  }

  try {
    let created = 0;
    let blocked = 0;
    const seenKeys = new Set();
    for (const tx of transactions) {
      const { uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco, tipo, numero_boleto, conta_contabil_id } = tx;
      const vDate = parseDateToPg(vencimento) || new Date().toISOString().split('T')[0];
      const pDate = parseDateToPg(pagamento);
      const normalizedNumber = normalizeBoletoNumber(numero_boleto);
      const localKey = normalizedNumber
        ? `BOLETO:${normalizedNumber}`
        : `BASE:${String(fornecedor || '').toUpperCase()}|${vDate}|${Number(valor || 0).toFixed(2)}`;
      if (seenKeys.has(localKey)) {
        blocked++;
        continue;
      }
      const duplicateRows = normalizedNumber
        ? await sql`
            SELECT id FROM transactions
            WHERE regexp_replace(upper(coalesce(numero_boleto, '')), '[^A-Z0-9]', '', 'g') = ${normalizedNumber}
            LIMIT 1`
        : await sql`
            SELECT id FROM transactions
            WHERE upper(coalesce(fornecedor, '')) = upper(${fornecedor})
              AND vencimento = ${vDate}
              AND abs(valor - ${valor}) < 0.0001
            LIMIT 1`;
      if (duplicateRows.length) {
        blocked++;
        continue;
      }
      await sql`
        INSERT INTO transactions (uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco, tipo, numero_boleto, conta_contabil_id)
        VALUES (${uid || 'guest'}, ${fornecedor}, ${descricao || '-'}, ${empresa || 'Geral'},
                ${vDate}, ${pDate}, ${valor}, ${status || 'PENDENTE'}, ${banco || null}, ${tipo || 'DESPESA'}, ${normalizedNumber || null}, ${conta_contabil_id || null})`;
      created++;
      seenKeys.add(localKey);
    }
    return res.status(201).json({ message: 'Batch processed', count: created, blocked });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
