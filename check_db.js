import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function fix() {
  const client = await pool.connect();
  try {
    // Listar TODOS criados desde 24/03 para o usuário confirmar
    const r = await client.query(`
      SELECT id, fornecedor, descricao, empresa, 
             vencimento::text, pagamento::text, valor, status,
             created_at::text
      FROM transactions 
      WHERE DATE(created_at AT TIME ZONE 'America/Manaus') >= '2026-03-24'
      ORDER BY created_at ASC
    `);
    
    console.log(`=== Lançamentos criados desde 24/03 (${r.rows.length} total) ===\n`);
    for (const x of r.rows) {
      console.log(`ID: ${x.id}`);
      console.log(`  Fornecedor: ${x.fornecedor} | ${x.empresa}`);
      console.log(`  Vencimento atual: ${x.vencimento} | Pagamento: ${x.pagamento}`);
      console.log(`  Valor: R$${x.valor} | Status: ${x.status}`);
      console.log(`  Criado em: ${x.created_at}`);
      console.log('');
    }

    if (r.rows.length === 0) {
      console.log("Nenhum lançamento encontrado criado desde 24/03.");
      return;
    }

    // Corrigir: trocar ano 2024 -> 2026 e 2025 que foi lancado manualmente
    // Atualiza todos criados desde 24/03 que têm vencimento com ano <= 2025 para deslocar para 2026
    const fix = await client.query(`
      UPDATE transactions
      SET vencimento = (vencimento + INTERVAL '2 years')
      WHERE DATE(created_at AT TIME ZONE 'America/Manaus') >= '2026-03-24'
        AND EXTRACT(YEAR FROM vencimento) <= 2024
      RETURNING id, fornecedor, vencimento::text
    `);
    
    console.log(`\n=== Datas corrigidas: ${fix.rows.length} registros atualizados ===`);
    fix.rows.forEach(x => console.log(`  ${x.fornecedor}: novo vencimento ${x.vencimento}`));

  } catch(e) {
    console.error("Erro:", e.message);
  } finally {
    client.release();
    pool.end();
  }
}
fix();
