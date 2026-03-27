const fs = require('fs');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

async function extractText(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = new Uint8Array(dataBuffer);
  
  const loadingTask = pdfjsLib.getDocument({ data, disableWorker: true });
  const pdfDocument = await loadingTask.promise;
  
  let text = '';
  for (let i = 1; i <= pdfDocument.numPages; i++) {
    const page = await pdfDocument.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    text += pageText + '\n';
  }
  return text;
}

async function run() {
  try {
    const files = fs.readdirSync('boletos_teste').filter(f => f.endsWith('.pdf'));
    for (const f of files) {
      console.log(`\n--- Extracted Text from ${f} ---`);
      const text = await extractText(`boletos_teste/${f}`);
      console.log(text.substring(0, 500));
      console.log('-------------------------');
    }
  } catch (err) {
    console.error('Error:', err.message || err);
  }
}

run();
