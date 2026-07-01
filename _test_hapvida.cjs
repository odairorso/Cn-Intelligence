const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const fs = require('fs');
const files = fs.readdirSync('./boletos_teste').filter(f => f.toLowerCase().endsWith('.pdf'));
console.log('Arquivos:', files);
(async () => {
  for (const f of files) {
    const buf = fs.readFileSync('./boletos_teste/' + f);
    const doc = await pdfjsLib.getDocument({data: new Uint8Array(buf)}).promise;
    let text = '';
    for (let i = 1; i <= Math.min(2, doc.numPages); i++) {
      const page = await doc.getPage(i);
      const c = await page.getTextContent();
      text += c.items.map(x => x.str).join(' ');
    }
    console.log('\n=== ' + f + ' ===');
    console.log(text.substring(0, 2000));
  }
})().catch(e => console.error(e.message));
