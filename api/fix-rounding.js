import { sql } from './_db.js';
import { handleError } from './_utils.js';

/**
 * POST /api?route=fix-rounding
 * Corrige automaticamente os valores de transactions com mais de 2 casas decimais.
 * Requer autenticação JWT com role = admin (operação destrutiva).
 */
export async function handleFixRounding(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const uid = req.authUid;
  const role = req.authRole;
  if (!uid) return res.status(401).json({ error: 'Autenticação necessária' });
  if (role !== 'admin') return res.status(403).json({ error: 'Acesso negado: apenas administradores podem corrigir valores.' });

  try {
    // 1. Listar quais transações têm valor errado (pertencentes ao usuário)
    const affected = await sql`
      SELECT id, fornecedor, valor::float8 as valor_atual, ROUND(valor::numeric, 2)::float8 as valor_correto
      FROM transactions
      WHERE uid = ${uid}
        AND deleted_at IS NULL
        AND ABS(valor::numeric - ROUND(valor::numeric, 2)) > 0.001
      ORDER BY ABS(valor::numeric - ROUND(valor::numeric, 2)) DESC
      LIMIT 500;
    `;

    if (affected.length === 0) {
      return res.json({ success: true, message: 'Nenhum valor com arredondamento incorreto encontrado.', fixed: 0 });
    }

    // 2. Corrigir valores
    const { rowCount: fixedValor } = await sql`
      UPDATE transactions
      SET valor = ROUND(valor::numeric, 2),
          updated_at = NOW()
      WHERE uid = ${uid}
        AND deleted_at IS NULL
        AND ABS(valor::numeric - ROUND(valor::numeric, 2)) > 0.001;
    `;

    // 3. Corrigir juros também
    const { rowCount: fixedJuros } = await sql`
      UPDATE transactions
      SET juros = ROUND(juros::numeric, 2),
          updated_at = NOW()
      WHERE uid = ${uid}
        AND deleted_at IS NULL
        AND juros IS NOT NULL
        AND ABS(juros::numeric - ROUND(juros::numeric, 2)) > 0.001;
    `;

    return res.json({
      success: true,
      message: `Correção concluída! ${fixedValor} lançamentos corrigidos.`,
      fixed_valor: fixedValor,
      fixed_juros: fixedJuros,
      amostra: affected.slice(0, 10).map(r => ({
        id: r.id,
        fornecedor: r.fornecedor,
        valor_antes: Number(r.valor_atual).toFixed(6),
        valor_depois: Number(r.valor_correto).toFixed(2)
      }))
    });

  } catch (e) {
    return handleError(res, e, 'fix-rounding');
  }
}
