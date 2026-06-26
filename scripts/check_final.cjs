require('dotenv').config();
const pg = require('pg');
const { Pool } = pg;

const pool = new Pool({ 
  connectionString: "postgresql://neondb_owner:npg_c9LaAv3hXNmD@ep-young-mouse-aclmtaes-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
});

pool.query("SELECT id, fornecedor, valor, vencimento, descricao FROM transactions WHERE fornecedor = 'QUIMISUL' AND vencimento = '2026-05-04'")
  .then(r => {
    console.log('Registros QUIMISUL 04/05/2026:');
    r.rows.forEach(row => console.log('ID:', row.id, '| Valor:', row.valor, '| Descrição:', row.descricao));
    pool.end();
  });