import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

async function run() {
  const fileName = process.argv[2] || 'boletos_teste/Claro Cn.pdf';
  try {
    const data = new Uint8Array(fs.readFileSync(fileName));
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        text += textContent.items.map(item => item.str).join(' ') + '\n';
    }
    fs.writeFileSync(fileName.replace('.pdf', '.txt'), text.trim());
    console.log(`Extracted text to ${fileName.replace('.pdf', '.txt')}`);
    console.log('--- Snippet ---');
    console.log(text.trim().substring(0, 1000));
  } catch (err) {
    console.error(err);
  }
}

run();
