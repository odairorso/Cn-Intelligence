const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function check() {
  try {
    const res = await sql`
      SELECT 
        SUM(valor) as sum_valor,
        SUM(CASE WHEN tipo = 'RECEITA' THEN valor ELSE 0 END) as sum_receitas,
        SUM(CASE WHEN tipo != 'RECEITA' THEN valor + COALESCE(juros, 0) ELSE 0 END) as sum_despesas,
        COUNT(*) as total_count
      FROM transactions
    `;
    console.log('--- GLOBAL TOTALS ---');
    console.log('Count:', res[0].total_count);
    console.log('Sum Valor (Base):', res[0].sum_valor);
    console.log('Sum Receitas:', res[0].sum_receitas);
    console.log('Sum Despesas (inc. juros):', res[0].sum_despesas);
    console.log('Global Balance:', Number(res[0].sum_receitas) - Number(res[0].sum_despesas));
    console.log('Global Absolute Total:', Number(res[0].sum_receitas) + Number(res[0].sum_despesas));
  } catch (e) {
    console.error(e);
  }
}

check();
