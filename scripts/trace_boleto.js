const fs = require('fs');
const path = require('path');

// Simular a extração de valor do PDF
const fakePdfText = `
EMPRESA QUIMISUL
CNPJ: 00.000.000/0001-00
NOSSO NUMERO: 1708281
VALOR DO BOLETO: R$ 699,00
DATA DE VENCIMENTO: 04/05/2026
`;

console.log('Texto simulado do PDF:');
console.log(fakePdfText);

// Teste da regex atual
const regexValor = /(?:R\$|VALOR|VALOR DO BOLETO|Valor|VALOR\s*[:\-]?\s*)[\s]*R?\$?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/i;
const matchValor = fakePdfText.match(regexValor);
console.log('\nMatch com regex atual:', matchValor);
if (matchValor && matchValor[1]) {
    const valorStr = String(matchValor[1]).replace(/\./g, '').replace(',', '.');
    const valorNum = parseFloat(valorStr);
    console.log('Valor extraído:', valorNum);
} else {
    console.log('Nenhum valor encontrado com regex atual');
}

// Teste da regex melhorada
const regexValorMelhorada = /(?:R\$|VALOR|VALOR DO BOLETO|Valor|VALOR\s*[:\-]?\s*|TOTAL\s*[:\-]?\s*)[\s]*R?\$?\s*(\d{1,3}(?:[\.\s]?\d{3})*(?:[,\s]\d{2})?)/i;
const matchValorMelhorado = fakePdfText.match(regexValorMelhorada);
console.log('\nMatch com regex melhorada:', matchValorMelhorado);
if (matchValorMelhorado && matchValorMelhorado[1]) {
    const valorStr = String(matchValorMelhorado[1]).replace(/\./g, '').replace(',', '.');
    const valorNum = parseFloat(valorStr);
    console.log('Valor extraído com regex melhorada:', valorNum);
} else {
    console.log('Nenhum valor encontrado com regex melhorada');
}