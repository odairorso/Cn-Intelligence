import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

async function run() {
  try {
    const data = new Uint8Array(fs.readFileSync('boletos_teste/00000011.pdf'));
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        text += textContent.items.map(item => item.str).join(' ') + '\n';
    }
    console.log('--- Extracted Text ---');
    console.log(text.trim());
  } catch (err) {
    console.error(err);
  }
}

run();
