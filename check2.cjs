require('dotenv').config();
const pg = require('pg');
const { Pool } = pg;

const pool = new Pool({ 
  connectionString: "postgresql://neondb_owner:npg_c9LaAv3hXNmD@ep-young-mouse-aclmtaes-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
});

pool.query('SELECT SUM(valor) as total FROM transactions')
  .then(r => {
    console.log('Valor total:', Number(r.rows[0].total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    pool.end();
  });