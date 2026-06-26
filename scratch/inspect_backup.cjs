const fs = require('fs');
const path = require('path');

const backupPath = 'c:/Users/Odair/Documents/Martelinho Lovable/backup-sistema-financeiro-2025-08-18.json';

function main() {
  if (!fs.existsSync(backupPath)) {
    console.error("Backup file not found at:", backupPath);
    return;
  }
  
  console.log("Reading backup file...");
  const data = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
  console.log("Backup properties:", Object.keys(data));
  
  // If it is an array of transactions or has a transactions key
  const txs = Array.isArray(data) ? data : data.transactions || [];
  console.log(`Found ${txs.length} transactions in backup.`);
  
  const searchValues = [2036.45, 6119.18, 1600.00, 1640.00, 3174.00, 2368.00];
  
  const matches = txs.filter(tx => {
    const fornecedor = String(tx.fornecedor || '').toUpperCase();
    return fornecedor.includes('BATISTOTE');
  });
  
  console.log(`Found ${matches.length} BATISTOTE transactions in backup:`);
  matches.forEach(tx => {
    console.log(`Venc: ${tx.vencimento} | Pag: ${tx.pagamento} | Valor: ${tx.valor} | Status: ${tx.status} | Desc: ${tx.descricao} | Empresa: ${tx.empresa}`);
  });
}

main();
