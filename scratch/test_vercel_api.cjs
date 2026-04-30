const fs = require('fs');
const https = require('https');

async function testVercel() {
  const pdfBuffer = fs.readFileSync('boletos_teste/BOL MAT EDUARDO - RADIOLOGIA - 26.01.pdf');
  const pdfBase64 = pdfBuffer.toString('base64');
  
  const payload = JSON.stringify({
    text: "E",
    fileName: "BOL MAT EDUARDO - RADIOLOGIA - 26.01.pdf",
    pdfBase64: pdfBase64
  });

  const req = https.request('https://cn-intelligence.vercel.app/api?route=extract-boleto', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('Status:', res.statusCode, '\nResponse:', data));
  });

  req.on('error', console.error);
  req.write(payload);
  req.end();
}

testVercel();
