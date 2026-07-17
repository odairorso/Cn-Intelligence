import { sql } from './_db.js';
import { handleError } from './_utils.js';

export async function handleCreateBank(req, res) {
  try {
    // 1. Find the owner uid from existing banks
    const existingBanks = await sql`
      SELECT DISTINCT uid FROM banks LIMIT 1;
    `;
    const uid = existingBanks.length > 0 ? existingBanks[0].uid : 'odair';

    // 2. Check if "BB Cen" already exists for this uid
    const existing = await sql`
      SELECT * FROM banks 
      WHERE uid = ${uid} AND LOWER(nome) = 'bb cen';
    `;

    if (existing.length > 0) {
      // If it exists, update the balance to 1632.40 if needed, or return success
      const updated = await sql`
        UPDATE banks 
        SET saldo = 1632.40, ativo = true
        WHERE id = ${existing[0].id}
        RETURNING *;
      `;
      return res.json({
        success: true,
        message: 'Conta bancária "BB Cen" já existia e teve o saldo atualizado!',
        bank: updated[0]
      });
    }

    // 3. Create the new bank account
    const inserted = await sql`
      INSERT INTO banks (uid, nome, saldo, ativo)
      VALUES (${uid}, 'BB Cen', 1632.40, true)
      RETURNING *;
    `;

    return res.json({
      success: true,
      message: 'Conta bancária "BB Cen" criada com sucesso!',
      bank: inserted[0]
    });

  } catch (e) {
    return handleError(res, e, 'temp-create-bank');
  }
}
