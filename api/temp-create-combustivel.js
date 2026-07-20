import { sql } from './_db.js';
import { handleError } from './_utils.js';

export async function handleCreateCombustivel(req, res) {
  try {
    // 1. Get all expense accounts
    const contas = await sql`
      SELECT id, codigo, nome, tipo, ativo FROM contas_contabeis 
      WHERE tipo = 'DESPESA' 
      ORDER BY codigo ASC;
    `;

    // 2. Find if a fuel account already exists (without matching "impostos")
    const existing = contas.find(c => {
      const n = c.nome.toLowerCase();
      return n.includes('combust') || n.includes('gasolina') || n.includes('etanol') || n.includes('diesel') || (n.includes('posto') && !n.includes('imposto'));
    });

    if (existing) {
      return res.json({
        success: true,
        message: `Já existe a conta contábil "${existing.nome}" (${existing.codigo})!`,
        account: existing
      });
    }

    // 3. Determine next code
    let nextNum = 28;
    const subNums = contas
      .map(c => {
        const parts = String(c.codigo).split('.');
        if (parts.length === 2 && parts[0] === '3') {
          return parseInt(parts[1], 10);
        }
        return 0;
      })
      .filter(n => !isNaN(n));

    if (subNums.length > 0) {
      const maxSub = Math.max(...subNums);
      nextNum = maxSub + 1;
    }

    const nextCode = `3.${nextNum}`;

    // 4. Create the new fuel account
    const inserted = await sql`
      INSERT INTO contas_contabeis (codigo, nome, tipo, ativo)
      VALUES (${nextCode}, 'Combustível e Veículos', 'DESPESA', true)
      RETURNING *;
    `;

    // Also update _utils.js targetCodigo if it was 3.17 to match nextCode
    return res.json({
      success: true,
      message: `Conta contábil "${inserted[0].nome}" (${inserted[0].codigo}) criada com sucesso!`,
      account: inserted[0]
    });

  } catch (e) {
    return handleError(res, e, 'temp-create-combustivel');
  }
}
