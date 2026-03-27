import { sql, parseDateToPg, setCors } from '../_db.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      const { uid } = req.query;
      const rows = uid
        ? await sql`SELECT * FROM transactions WHERE uid = ${uid} ORDER BY vencimento DESC`
        : await sql`SELECT * FROM transactions ORDER BY vencimento DESC`;

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
      const vDate = parseDateToPg(vencimento);
      const pDate = parseDateToPg(pagamento);
      const rows = await sql`
        INSERT INTO transactions (uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco, tipo, numero_boleto, conta_contabil_id)
        VALUES (${uid || 'guest'}, ${fornecedor}, ${descricao || '-'}, ${empresa || 'Geral'},
                ${vDate}, ${pDate}, ${valor}, ${status || 'PENDENTE'}, ${banco || null}, ${tipo || 'DESPESA'}, ${numero_boleto || null}, ${conta_contabil_id || null})
        RETURNING *`;
      return res.status(201).json(rows[0]);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
