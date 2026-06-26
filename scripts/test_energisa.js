import fs from 'fs';
import pdfParse from 'pdf-parse';

async function run() {
  const buf = fs.readFileSync('boletos_teste/ENERGISAMS-Fat-Matricula-0001895439-04-2026.PDF');
  const data = await pdfParse(buf);
  console.log('TEXTO:', data.text.substring(0, 5000));
}
run();
