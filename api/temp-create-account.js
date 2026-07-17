import { sql } from './_db.js';
import { handleError } from './_utils.js';

export async function handleCreateAccount(req, res) {
  try {
    // 1. Get all revenue accounts to find the next available code
    const contas = await sql`
      SELECT codigo FROM contas_contabeis 
      WHERE tipo = 'RECEITA' 
      ORDER BY codigo ASC;
    `;

    // 2. Find if "Colônia de Férias" already exists
    const existing = await sql`
      SELECT * FROM contas_contabeis 
      WHERE LOWER(nome) = 'colônia de férias' OR LOWER(nome) = 'colonia de ferias';
    `;

    if (existing.length > 0) {
      return res.json({
        success: true,
        message: 'A conta "Colônia de Férias" já existe!',
        account: existing[0]
      });
    }

    // 3. Determine the next code
    let nextCode = '1.01';
    if (contas.length > 0) {
      // Find all codes that fit the pattern of decimal numbers (e.g. '1.15', '1.02')
      const codes = contas
        .map(c => parseFloat(c.codigo))
        .filter(val => !isNaN(val));
      
      if (codes.length > 0) {
        const maxCode = Math.max(...codes);
        nextCode = (Math.round((maxCode + 0.01) * 100) / 100).toFixed(2);
      }
    }

    // 4. Insert the new account
    const inserted = await sql`
      INSERT INTO contas_contabeis (codigo, nome, tipo, ativo)
      VALUES (${nextCode}, 'Colônia de Férias', 'RECEITA', true)
      RETURNING *;
    `;

    return res.json({
      success: true,
      message: 'Conta contábil "Colônia de Férias" criada com sucesso!',
      account: inserted[0]
    });

  } catch (e) {
    return handleError(res, e, 'temp-create-account');
  }
}
