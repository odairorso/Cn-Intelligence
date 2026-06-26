const pg = require('pg');
const fs = require('fs');
require('dotenv').config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    const res = await pool.query(`
      SELECT fornecedor, vencimento::text, valor, empresa, descricao, id
      FROM transactions
      WHERE status = 'PENDENTE' AND vencimento < '2026-02-01'
      ORDER BY fornecedor ASC, vencimento ASC
    `);

    let md = `# Relatório de Pendências Antigas (Anteriores a Fevereiro/2026)\n\n`;
    md += `Este relatório foi gerado para auxiliar na auditoria individual das transações pendentes no sistema.\n\n`;
    md += `**Total de transações pendentes:** ${res.rows.length}\n`;
    
    const totalVal = res.rows.reduce((sum, r) => sum + parseFloat(r.valor), 0);
    md += `**Valor total pendente:** ${totalVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n\n`;
    
    // Group by supplier
    const grouped = {};
    res.rows.forEach(r => {
      grouped[r.fornecedor] = grouped[r.fornecedor] || [];
      grouped[r.fornecedor].push(r);
    });

    md += `## Resumo por Fornecedor\n\n`;
    md += `| Fornecedor | Qtd Boletos | Valor Total |\n`;
    md += `| :--- | :---: | :--- |\n`;
    
    const sortedSuppliers = Object.keys(grouped).sort((a, b) => grouped[b].length - grouped[a].length);
    
    sortedSuppliers.forEach(supplier => {
      const txs = grouped[supplier];
      const sum = txs.reduce((s, r) => s + parseFloat(r.valor), 0);
      md += `| ${supplier} | ${txs.length} | ${sum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} |\n`;
    });
    
    md += `\n---\n\n## Detalhamento de Boletos por Fornecedor\n\n`;
    
    sortedSuppliers.forEach(supplier => {
      const txs = grouped[supplier];
      const sum = txs.reduce((s, r) => s + parseFloat(r.valor), 0);
      
      md += `### ${supplier} (${txs.length} boletos - Total: ${sum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})\n\n`;
      md += `| Vencimento | Valor | Empresa | Descrição | ID no Banco |\n`;
      md += `| :---: | :--- | :---: | :--- | :--- |\n`;
      
      txs.forEach(tx => {
        const dateParts = tx.vencimento.split('-');
        const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
        const val = parseFloat(tx.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        md += `| ${formattedDate} | ${val} | ${tx.empresa || '-'} | ${tx.descricao || '-'} | \`${tx.id}\` |\n`;
      });
      
      md += `\n`;
    });

    fs.writeFileSync('relatorio_pendencias_antigas.md', md);
    console.log("Report generated successfully: relatorio_pendencias_antigas.md");
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

main();
