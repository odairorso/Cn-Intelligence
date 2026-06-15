import { config } from 'dotenv';
import pg from 'pg';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    // 1. Mostrar usuários cadastrados
    const usersRes = await pool.query('SELECT * FROM users');
    console.log('--- Usuários Cadastrados ---');
    console.table(usersRes.rows);

    // 2. Executar a consulta do handleStats com uid = 'odair' (ou o primeiro uid encontrado)
    const activeUid = usersRes.rows[0]?.uid || 'odair';
    console.log(`\n--- Executando consulta de KPIs para uid = '${activeUid}' ---`);

    const query = `
      SELECT
        COALESCE(SUM(CASE WHEN UPPER(tipo) = 'RECEITA' THEN (CASE WHEN valor::text = 'NaN' THEN 0 ELSE valor END) ELSE 0 END), 0) as total_receitas,
        COALESCE(SUM(CASE WHEN UPPER(tipo) = 'DESPESA'
          THEN (CASE WHEN valor::text = 'NaN' THEN 0 ELSE valor END)
             + (CASE WHEN juros IS NULL OR juros::text = 'NaN' THEN 0 ELSE juros END)
          ELSE 0 END), 0) as total_despesas,
        COALESCE(SUM(CASE WHEN UPPER(tipo) = 'TRANSFERENCIA'
          THEN (CASE WHEN valor::text = 'NaN' THEN 0 ELSE valor END)
             + (CASE WHEN juros IS NULL OR juros::text = 'NaN' THEN 0 ELSE juros END)
          ELSE 0 END), 0) as total_transferencias,
        COALESCE(SUM(
          ABS(CASE WHEN valor::text = 'NaN' THEN 0 ELSE valor END)
          + (CASE WHEN juros IS NULL OR juros::text = 'NaN' THEN 0 ELSE juros END)
        ), 0) as total_geral,
        COUNT(CASE WHEN status = 'PAGO' AND tipo != 'TRANSFERENCIA' THEN 1 END) as count_pagos,
        COUNT(CASE WHEN (status = 'PENDENTE' OR status = 'VENCIDO') AND (vencimento >= CURRENT_DATE OR vencimento IS NULL) AND tipo != 'TRANSFERENCIA' THEN 1 END) as count_pendentes,
        COUNT(CASE WHEN (status = 'VENCIDO' OR (status = 'PENDENTE' AND vencimento < CURRENT_DATE)) AND tipo != 'TRANSFERENCIA' THEN 1 END) as count_vencidos,
        COUNT(CASE WHEN tipo != 'TRANSFERENCIA' THEN 1 END) as total_count
      FROM transactions
      WHERE 1=1 AND (uid = $1 OR uid IS NULL);
    `;

    const statsRes = await pool.query(query, [activeUid]);
    console.table(statsRes.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
