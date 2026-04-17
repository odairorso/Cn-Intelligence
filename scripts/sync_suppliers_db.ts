import { sql } from '../api/_db.js';

async function sync() {
  console.log('--- Sincronizando Fornecedores ---');
  try {
    // 1. Pega fornecedores únicos que existem nos lançamentos mas não na tabela de fornecedores
    const missing = await sql`
      SELECT DISTINCT t.fornecedor
      FROM transactions t
      LEFT JOIN suppliers s ON upper(t.fornecedor) = upper(s.nome)
      WHERE s.id IS NULL AND t.fornecedor IS NOT NULL AND t.fornecedor <> ''
    `;

    console.log(`Encontrados ${missing.length} fornecedores para sincronizar.`);

    for (const row of missing) {
      console.log(`Verificando e Cadastrando: ${row.fornecedor}`);
      const exists = await sql`SELECT id FROM suppliers WHERE upper(nome) = upper(${row.fornecedor}) LIMIT 1`;
      if (exists.length === 0) {
        await sql`
          INSERT INTO suppliers (uid, nome)
          VALUES ('guest', ${row.fornecedor})
        `;
        console.log(`  -> Cadastrado: ${row.fornecedor}`);
      } else {
        console.log(`  -> Já existe: ${row.fornecedor}`);
      }
    }

    console.log('--- Sincronização concluída com sucesso! ---');
  } catch (e) {
    console.error('Erro na sincronização:', e.message);
  }
}

sync();
