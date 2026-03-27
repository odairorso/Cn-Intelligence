const xlsx = require('xlsx');
const fs = require('fs');

const filePath = './Fluxo de caixa - Grupo CN 2024_2025.xlsx';

function dumpHeaders() {
  if (!fs.existsSync(filePath)) {
    console.error('Arquivo não encontrado:', filePath);
    return;
  }
  const buffer = fs.readFileSync(filePath);
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  
  const sheetsToTrack = ['Janeiro 26', 'Fev 26', 'Dezembro 25'];
  
  sheetsToTrack.forEach(sheetName => {
    console.log(`\n--- Aba: ${sheetName} ---`);
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      console.log('Aba não encontrada!');
      return;
    }
    const matrix = xlsx.utils.sheet_to_json(worksheet, { header: 1 }) ;
    if (matrix.length > 0) {
      console.log('Headers encontrados:', matrix[0]);
      if (matrix.length > 1) {
        console.log('Primeira linha de dados:', matrix[1]);
      }
    }
  });
}
dumpHeaders();
