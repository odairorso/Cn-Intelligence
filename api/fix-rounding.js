import { sql } from './_db.js';
import { handleError } from './_utils.js';

/**
 * GET /api?route=fix-rounding
 * Corrige automaticamente todos os valores de transactions com mais de 2 casas decimais.
 * Só pode ser executado com o BACKUP_TOKEN correto por segurança.
 */
export async function handleFixRounding(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.query.token || req.headers['x-backup-token'];
  if (!token || token !== process.env.BACKUP_TOKEN) {
    return res.status(403).json({ error: 'Token inválido' });
  }

  try {
    // 1. Listar quais transações têm valor errado
    const affected = await sql`
      SELECT id, fornecedor, valor::float8 as valor_atual, ROUND(valor::numeric, 2)::float8 as valor_correto
      FROM transactions
      WHERE deleted_at IS NULL
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
      WHERE deleted_at IS NULL
        AND ABS(valor::numeric - ROUND(valor::numeric, 2)) > 0.001;
    `;

    // 3. Corrigir juros também
    const { rowCount: fixedJuros } = await sql`
      UPDATE transactions
      SET juros = ROUND(juros::numeric, 2),
          updated_at = NOW()
      WHERE deleted_at IS NULL
        AND juros IS NOT NULL
        AND ABS(juros::numeric - ROUND(juros::numeric, 2)) > 0.001;
    `;

    return res.json({
      success: true,
      message: `Correção concluída!`,
      fixed_valor: fixedValor,
      fixed_juros: fixedJuros,
      sample_before: affected.slice(0, 10).map(r => ({
        id: r.id,
        fornecedor: r.fornecedor,
        valor_antes: r.valor_atual,
        valor_depois: r.valor_correto
      }))
    });

  } catch (e) {
    return handleError(res, e, 'fix-rounding');
  }
}
