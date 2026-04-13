const fs = require('fs');
const path = require('path');

async function run() {
  // Tentar com pdf-parse
  try {
    const pdfParse = require('pdf-parse');
    const files = fs.readdirSync('./boletos_teste').filter(f => f.endsWith('.pdf'));
    
    for (const file of files) {
      console.log('\n=============================');
      console.log('ARQUIVO:', file);
      console.log('=============================');
      const buf = fs.readFileSync(path.join('./boletos_teste', file));
      const data = await pdfParse(buf);
      console.log('TEXTO EXTRAÍDO:');
      console.log(data.text);
    }
  } catch(e) {
    console.error('Erro pdf-parse:', e.message);
    
    // Tentar pdfjs-dist
    try {
      const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
      const files = fs.readdirSync('./boletos_teste').filter(f => f.endsWith('.pdf'));
      
      for (const file of files) {
        console.log('\n=============================');
        console.log('ARQUIVO:', file);
        const buf = fs.readFileSync(path.join('./boletos_teste', file));
        const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
        let text = '';
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map(item => item.str).join(' ') + '\n';
        }
        console.log('TEXTO:', text.substring(0, 3000));
      }
    } catch(e2) {
      console.error('Erro pdfjs:', e2.message);
    }
  }
}

run();
