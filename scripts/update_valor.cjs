require('dotenv').config();
const pg = require('pg');
const { Pool } = pg;

const pool = new Pool({ 
  connectionString: "postgresql://neondb_owner:npg_c9LaAv3hXNmD@ep-young-mouse-aclmtaes-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
});

pool.query("UPDATE transactions SET valor = 699.00 WHERE fornecedor = 'QUIMISUL' AND vencimento = '2026-05-04' AND valor < 10 RETURNING id, valor, fornecedor")
  .then(r => {
    console.log('Registro atualizado:');
    console.log('ID:', r.rows[0].id);
    console.log('Fornecedor:', r.rows[0].fornecedor);
    console.log('Novo valor:', r.rows[0].valor);
    pool.end();
  })
  .catch(err => {
    console.error('Erro:', err);
    pool.end();
  });