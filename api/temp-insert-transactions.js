import { sql } from './_db.js';
import { getContaContabilId, handleError } from './_utils.js';

export async function handleInsertTransactions(req, res) {
  try {
    // 1. Find the owner uid from existing banks
    const existingBanks = await sql`
      SELECT DISTINCT uid FROM banks LIMIT 1;
    `;
    const uid = existingBanks.length > 0 ? existingBanks[0].uid : 'odair';

    // 2. Adjust "BB Cen" initial balance to 505.50
    // (so that with the transactions, the calculated balance is exactly 1632.40)
    await sql`
      UPDATE banks 
      SET saldo = 505.50
      WHERE uid = ${uid} AND LOWER(nome) = 'bb cen';
    `;

    // 3. Define transactions list
    const list = [
      { date: '2026-07-01', value: 180.00, type: 'RECEITA', name: 'JULIANA VAR', desc: 'Pix-Recebido QR Code' },
      { date: '2026-07-01', value: 180.00, type: 'RECEITA', name: 'JANAINY ZATTA', desc: 'Pix-Recebido QR Code' },
      { date: '2026-07-01', value: 120.00, type: 'RECEITA', name: 'ALEXANDRA CAND', desc: 'Pix - Recebido' },
      { date: '2026-07-01', value: 60.00, type: 'RECEITA', name: 'CRISTIANE B', desc: 'Pix - Recebido' },
      { date: '2026-07-01', value: 60.00, type: 'RECEITA', name: 'Cristiane Buss', desc: 'Pix - Recebido' },
      { date: '2026-07-01', value: 180.00, type: 'RECEITA', name: 'MILTON NAKASSU', desc: 'Pix-Recebido QR Code' },
      { date: '2026-07-02', value: 120.00, type: 'RECEITA', name: 'FRANCIELI ESPI', desc: 'Pix-Recebido QR Code' },
      { date: '2026-07-03', value: 80.00, type: 'RECEITA', name: 'FLAVIA CRIS', desc: 'Pix - Recebido' },
      { date: '2026-07-06', value: 120.00, type: 'RECEITA', name: 'ROVENE PEREIRA', desc: 'Pix - Recebido' },
      { date: '2026-07-06', value: 93.10, type: 'DESPESA', name: 'Tarifa Pacote de Serviços', desc: 'Cobrança referente 06/07/2026' },
      { date: '2026-07-13', value: 120.00, type: 'RECEITA', name: 'DULHAN VEIC', desc: 'Pix - Recebido' }
    ];

    let insertedCount = 0;
    const insertedDetails = [];

    // 4. Insert each transaction
    for (const tx of list) {
      // Resolve category
      const ccId = await getContaContabilId(tx.name, tx.desc, tx.type);

      const rows = await sql`
        INSERT INTO transactions (
          uid, fornecedor, descricao, empresa, vencimento, pagamento, 
          valor, status, banco, tipo, conta_contabil_id, created_by
        )
        VALUES (
          ${uid}, ${tx.name}, ${tx.desc}, 'CN', ${tx.date}, ${tx.date}, 
          ROUND(${tx.value}::numeric, 2), 'PAGO', 'BB Cen', ${tx.type}, ${ccId ?? null}, ${uid}
        )
        RETURNING *;
      `;
      insertedCount++;
      insertedDetails.push(rows[0]);
    }

    return res.json({
      success: true,
      message: 'Todos os 11 lançamentos foram criados e o saldo da conta BB Cen ajustado para fechar com o extrato!',
      inserted: insertedCount,
      details: insertedDetails.map(r => ({
        id: r.id,
        fornecedor: r.fornecedor,
        valor: r.valor,
        tipo: r.tipo,
        vencimento: r.vencimento
      }))
    });

  } catch (e) {
    return handleError(res, e, 'temp-insert-transactions');
  }
}
