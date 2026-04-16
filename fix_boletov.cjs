require('dotenv').config();
const pg = require('pg');
const { Pool } = pg;

const pool = new Pool({ 
  connectionString: "postgresql://neondb_owner:npg_c9LaAv3hXNmD@ep-young-mouse-aclmtaes-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
});

// Primeiro, encontrar o registro errado
pool.query("SELECT id, fornecedor, valor, vencimento, descricao FROM transactions WHERE fornecedor = 'QUIMISUL' AND vencimento = '2026-05-04' AND valor < 10")
  .then(r => {
    if (r.rows.length === 0) {
      console.log('Nenhum registro encontrado com QUIMISUL, 04/05/2026 e valor < 10');
      return pool.end();
    }
    
    const row = r.rows[0];
    console.log('Registro encontrado para correção:');
    console.log('ID:', row.id);
    console.log('Valor atual:', row.valor);
    console.log('Fornecedor:', row.fornecedor);
    console.log('Vencimento:', row.vencimento);
    console.log('Descrição:', row.descricao);
    
    // Atualizar para o valor correto
    return pool.query("UPDATE transactions SET valor = 699.00 WHERE id = $1 RETURNING id, valor, fornecedor", [row.id]);
  })
  .then(r => {
    if (r && r.rows) {
      console.log('Registro atualizado com sucesso:');
      console.log('ID:', r.rows[0].id);
      console.log('Novo valor:', r.rows[0].valor);
      console.log('Fornecedor:', r.rows[0].fornecedor);
    }
    return pool.end();
  })
  .catch(err => {
    console.error('Erro:', err);
    pool.end();
  });