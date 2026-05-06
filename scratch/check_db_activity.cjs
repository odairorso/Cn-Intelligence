
require('dotenv').config();
const { Pool } = require('pg');

async function checkActivity() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('--- Atividade Atual do Banco de Dados ---');
    
    const res = await pool.query(`
      SELECT 
        pid,
        now() - query_start as duration,
        query,
        state,
        client_addr
      FROM pg_stat_activity 
      WHERE state != 'idle' 
      AND query NOT LIKE '%pg_stat_activity%'
      ORDER BY duration DESC;
    `);

    if (res.rows.length === 0) {
      console.log('Nenhuma query ativa no momento (além de ociosa).');
    } else {
      res.rows.forEach(row => {
        console.log(`\nPID: ${row.pid}`);
        console.log(`Duração: ${row.duration}`);
        console.log(`Estado: ${row.state}`);
        console.log(`Origem (IP): ${row.client_addr}`);
        console.log(`Query: ${row.query.substring(0, 200)}...`);
      });
    }

    const totalRes = await pool.query(`SELECT count(*) FROM pg_stat_activity;`);
    console.log(`\nTotal de conexões abertas: ${totalRes.rows[0].count}`);

  } catch (err) {
    console.error('Erro ao verificar atividade:', err.message);
  } finally {
    await pool.end();
  }
}

checkActivity();
