const pg = require('pg');
require('dotenv').config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const isDryRun = process.argv.includes('--execute') === false;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Get list of what will be updated
    const listRes = await client.query(`
      SELECT id, fornecedor, vencimento::text, valor, status, empresa
      FROM transactions
      WHERE status = 'PENDENTE' AND vencimento < '2026-02-01'
      ORDER BY vencimento ASC, fornecedor ASC
    `);
    
    console.log(`[${isDryRun ? 'DRY-RUN' : 'EXECUTE'}] Found ${listRes.rows.length} pending transactions before 2026-02-01:`);
    
    if (listRes.rows.length === 0) {
      console.log("No transactions need to be updated.");
      await client.query('ROLLBACK');
      return;
    }

    // Print summary by supplier
    const summary = {};
    listRes.rows.forEach(r => {
      summary[r.fornecedor] = (summary[r.fornecedor] || 0) + 1;
    });
    console.log("\nSummary by supplier:");
    console.table(Object.entries(summary).map(([supplier, count]) => ({ Fornecedor: supplier, Quantidade: count })));

    if (isDryRun) {
      console.log("\n>>> This is a DRY-RUN. No changes were saved. <<<");
      console.log("To apply the changes, run: node scratch/fix_stale_pending.cjs --execute");
      await client.query('ROLLBACK');
    } else {
      console.log("\nUpdating transactions in database...");
      
      const updateRes = await client.query(`
        UPDATE transactions
        SET status = 'PAGO', 
            pagamento = vencimento,
            updated_at = NOW()
        WHERE status = 'PENDENTE' AND vencimento < '2026-02-01'
      `);
      
      console.log(`Successfully updated ${updateRes.rowCount} transactions to PAGO!`);
      await client.query('COMMIT');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error during execution:", err);
  } finally {
    client.release();
    pool.end();
  }
}

main();
