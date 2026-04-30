
import dotenv from 'dotenv';
dotenv.config();
const { sql } = await import('../api/_db.js');

async function testStats() {
  try {
    const filterUid = 'guest';
    const kpiRows = await sql`
      SELECT 
        COALESCE(SUM(CASE WHEN tipo = 'RECEITA' THEN valor ELSE 0 END), 0) as total_receitas,
        COALESCE(SUM(CASE WHEN tipo != 'RECEITA' THEN valor + COALESCE(juros, 0) ELSE 0 END), 0) as total_despesas,
        COUNT(CASE WHEN status = 'PAGO' THEN 1 END) as count_pagos,
        COUNT(CASE WHEN status = 'PENDENTE' AND (vencimento >= CURRENT_DATE OR vencimento IS NULL) THEN 1 END) as count_pendentes,
        COUNT(CASE WHEN status = 'VENCIDO' OR (status = 'PENDENTE' AND vencimento < CURRENT_DATE) THEN 1 END) as count_vencidos,
        COUNT(*) as total_count
      FROM transactions
      WHERE uid = ${filterUid}`;
    
    console.log('Stats for guest:', kpiRows);
  } catch (err) {
    console.error('Stats test failed:', err);
  }
}

testStats();
