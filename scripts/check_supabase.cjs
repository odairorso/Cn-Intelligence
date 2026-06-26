require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function check() {
  try {
    const indexes = await pool.query("SELECT indexname FROM pg_indexes WHERE tablename = 'transactions' ORDER BY indexname");
    console.log('=== INDEXES transactions ===');
    for (const r of indexes.rows) console.log('  ' + r.indexname);

    const suppliers = await pool.query("SELECT indexname FROM pg_indexes WHERE tablename = 'suppliers' ORDER BY indexname");
    console.log('\n=== INDEXES suppliers ===');
    for (const r of suppliers.rows) console.log('  ' + r.indexname);

    const funcs = await pool.query("SELECT proname FROM pg_proc WHERE proname LIKE 'immutable_%'");
    console.log('\n=== FUNCOES IMMUTABLE ===');
    for (const r of funcs.rows) console.log('  ' + r.proname);

    const count = await pool.query('SELECT COUNT(*) as total FROM transactions WHERE deleted_at IS NULL');
    console.log('\n=== TOTAL TRANSACOES ===');
    console.log('  ' + count.rows[0].total);
  } catch (e) {
    console.error('ERRO:', e.message);
  } finally {
    await pool.end();
  }
}
check();
