import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function testUpdate() {
  const client = await pool.connect();
  try {
    // 1. Encontrar uma transação PAGO
    const res = await client.query("SELECT id FROM transactions WHERE status = 'PAGO' LIMIT 1");
    if (res.rows.length === 0) {
      console.log("Nenhuma transação PAGO encontrada para teste.");
      return;
    }
    const id = res.rows[0].id;
    console.log(`Testando com ID: ${id}`);

    // 2. Tentar atualizar para PENDENTE e limpar pagamento
    const payload = {
      status: 'PENDENTE',
      pagamento: null,
      vencimento: '15/05/2026' // Valor dummy
    };

    // Simulando o que o server.js faz internamente
    const pDate = null;
    const vDate = '2026-05-15';

    const updateRes = await client.query(
      `UPDATE transactions SET
        status = $1,
        pagamento = $2::date,
        vencimento = $3::date,
        updated_at = NOW()
      WHERE id = $4 RETURNING *`,
      [payload.status, pDate, vDate, id]
    );

    const updated = updateRes.rows[0];
    console.log("Resultado do Update:");
    console.log(`Status: ${updated.status} (Esperado: PENDENTE)`);
    console.log(`Pagamento: ${updated.pagamento} (Esperado: null)`);

    if (updated.status === 'PENDENTE' && updated.pagamento === null) {
      console.log("SUCESSO: O bug do COALESCE foi resolvido!");
    } else {
      console.log("FALHA: O bug ainda persiste.");
    }

  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    client.release();
    pool.end();
    process.exit(0);
  }
}
testUpdate();
