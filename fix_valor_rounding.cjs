/**
 * fix_valor_rounding.cjs
 * 
 * Corrige todos os valores em transactions que têm mais de 2 casas decimais
 * ou que foram armazenados com erro de ponto flutuante.
 * 
 * Executa: node fix_valor_rounding.cjs
 */

const pg = require('pg');
require('dotenv').config();

const { Pool } = pg;

async function fixValorRounding() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    console.log('🔍 Buscando transações com valor com mais de 2 casas decimais...\n');

    // Listar transações afetadas ANTES da correção
    const { rows: before } = await client.query(`
      SELECT id, fornecedor, valor, valor::numeric AS valor_num,
             ROUND(valor::numeric, 2) AS valor_correto,
             (valor::numeric - ROUND(valor::numeric, 2)) AS diferenca
      FROM transactions
      WHERE deleted_at IS NULL
        AND ABS(valor::numeric - ROUND(valor::numeric, 2)) > 0.001
      ORDER BY ABS(valor::numeric - ROUND(valor::numeric, 2)) DESC
      LIMIT 100;
    `);

    if (before.length === 0) {
      console.log('✅ Nenhuma transação com valor errado encontrada!');
      client.release();
      await pool.end();
      return;
    }

    console.log(`⚠️  Encontradas ${before.length} transações com valor incorreto:\n`);
    for (const row of before) {
      console.log(`  ID ${row.id} | ${String(row.fornecedor).padEnd(35)} | Atual: R$ ${Number(row.valor_num).toFixed(6)} → Correto: R$ ${Number(row.valor_correto).toFixed(2)}`);
    }

    console.log('\n🔧 Aplicando correção (ROUND para 2 casas decimais)...');

    // Aplicar a correção
    const { rowCount } = await client.query(`
      UPDATE transactions
      SET valor = ROUND(valor::numeric, 2),
          updated_at = NOW()
      WHERE deleted_at IS NULL
        AND ABS(valor::numeric - ROUND(valor::numeric, 2)) > 0.001;
    `);

    console.log(`\n✅ ${rowCount} transação(ões) corrigida(s) com sucesso!`);

    // Verificar também juros
    const { rows: jurosRows } = await client.query(`
      SELECT COUNT(*) AS cnt FROM transactions
      WHERE deleted_at IS NULL
        AND juros IS NOT NULL
        AND ABS(juros::numeric - ROUND(juros::numeric, 2)) > 0.001;
    `);

    const jurCount = parseInt(jurosRows[0].cnt);
    if (jurCount > 0) {
      console.log(`\n⚠️  Encontradas ${jurCount} transações com juros incorretos. Corrigindo...`);
      const { rowCount: jurFixed } = await client.query(`
        UPDATE transactions
        SET juros = ROUND(juros::numeric, 2),
            updated_at = NOW()
        WHERE deleted_at IS NULL
          AND juros IS NOT NULL
          AND ABS(juros::numeric - ROUND(juros::numeric, 2)) > 0.001;
      `);
      console.log(`✅ ${jurFixed} registro(s) de juros corrigido(s)!`);
    } else {
      console.log('\n✅ Nenhum valor de juros incorreto encontrado.');
    }

    // Mostrar resultado final
    console.log('\n📊 Verificação pós-correção:');
    const { rows: after } = await client.query(`
      SELECT COUNT(*) AS cnt FROM transactions
      WHERE deleted_at IS NULL
        AND ABS(valor::numeric - ROUND(valor::numeric, 2)) > 0.001;
    `);
    console.log(`   Transações com valor incorreto restantes: ${after[0].cnt}`);

  } catch (err) {
    console.error('❌ Erro durante a correção:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

fixValorRounding().catch(err => {
  console.error(err);
  process.exit(1);
});
