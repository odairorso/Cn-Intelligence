const xlsx = require('xlsx');
const fs = require('fs');

const filePath = './Fluxo de caixa - Grupo CN 2024_2025.xlsx';

function deepInspectSheets() {
  const buffer = fs.readFileSync(filePath);
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  
  const targets = ['Julho 25  ', 'Dezembro 25 ', 'Janeiro 26'];
  targets.forEach(s => {
      const ws = workbook.Sheets[s];
      if (!ws) {
          console.log(`Sheet [${s}] NOT FOUND!`);
          return;
      }
      console.log(`Sheet [${s}] range: ${ws['!ref']}`);
      const m = xlsx.utils.sheet_to_json(ws, { header: 1 });
      console.log(`  First row sample: ${m[0] ? m[0].join(', ') : 'Empty'}`);
      console.log(`  Rows count: ${m.length}`);
  });
}
deepInspectSheets();
