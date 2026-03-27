const fs = require('fs');
const texto = fs.readFileSync('boletos_teste/exemplo_boleto.txt', 'utf-8');
const linhas = texto.split('\n');

console.log('=== DEBUG REGEX ===');
console.log('Total linhas:', linhas.length);

for (let i = 0; i < linhas.length; i++) {
  const linha = linhas[i];
  if (linha.includes('VALOR') || linha.includes('R$')) {
    console.log(`Linha ${i}: "${linha}"`);
    
    // Testar regex
    const match = linha.match(/VALOR.*?(\d{1,3}(?:\.\d{3})*(?:,\d{2}))/i);
    console.log('  Match valor:', match);
  }
  
  if (linha.includes('VENCIMENTO') || linha.includes('Venc')) {
    console.log(`Linha ${i}: "${linha}"`);
    
    const match = linha.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    console.log('  Match data:', match);
  }
}
