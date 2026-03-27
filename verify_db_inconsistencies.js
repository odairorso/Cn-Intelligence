require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log("=== VERIFICANDO DADOS DISCREPANTES NO BANCO ===\n");

    // 1. DISTRIBUIÇÃO POR MÊS/ANO
    const resDist = await pool.query(`
      SELECT 
        SUBSTRING(vencimento, 7, 4) AS ano,
        SUBSTRING(vencimento, 4, 2) AS mes,
        COUNT(*) AS total,
        ROUND(SUM(valor)::numeric, 2) AS soma_valor
      FROM transactions
      WHERE uid = 'guest'
      GROUP BY ano, mes
      ORDER BY ano DESC, mes DESC
      LIMIT 20;
    `);
    console.log('--- DISTRIBUIÇÃO DE LANÇAMENTOS POR MÊS/ANO ---');
    console.table(resDist.rows);

    // 2. LANÇAMENTOS APÓS MARÇO DE 2026
    const resFuturos = await pool.query(`
      SELECT id, fornecedor, valor, vencimento, empresa, status
      FROM transactions 
      WHERE uid = 'guest' 
      AND (
        SUBSTRING(vencimento, 7, 4)::int > 2026 
        OR (SUBSTRING(vencimento, 7, 4)::int = 2026 AND SUBSTRING(vencimento, 4, 2)::int > 3)
      )
      ORDER BY vencimento DESC
      LIMIT 30;
    `);
    console.log('\n--- LANÇAMENTOS APÓS MARÇO DE 2026 ---');
    console.log(`Encontrados: ${resFuturos.rowCount} registros`);
    if (resFuturos.rowCount > 0) {
      console.table(resFuturos.rows.map(r => ({
        ...r,
        valor: 'R$ ' + r.valor
      })));
    }

    // 3. VALORES EXORBITANTES (Ex: maiores que R$ 100.000)
    const resExorbitantes = await pool.query(`
      SELECT id, fornecedor, valor, vencimento, empresa
      FROM transactions 
      WHERE uid = 'guest' AND valor > 50000
      ORDER BY valor DESC
      LIMIT 20;
    `);
    console.log('\n--- VALORES SUSPEITOS (> R$ 50.000) ---');
    console.log(`Encontrados: ${resExorbitantes.rowCount} registros`);
    if (resExorbitantes.rowCount > 0) {
      console.table(resExorbitantes.rows.map(r => ({
        ...r,
        valor: 'R$ ' + r.valor
      })));
    }

  } catch (error) {
    console.error('Erro na consulta:', error);
  } finally {
    await pool.end();
  }
}

run();
