const fs = require('fs');
const pdfParse = require('pdf-parse');

async function run() {
  try {
    const dataBuffer = fs.readFileSync('boletos_teste/00000011.pdf');
    const pdfData = await pdfParse(dataBuffer);
    const text = pdfData.text;
    console.log('--- Extracted Text ---');
    console.log(text.slice(0, 1000));
    console.log('--- End Text ---');
  } catch (err) {
    console.error('Error:', err);
  }
}
run();
