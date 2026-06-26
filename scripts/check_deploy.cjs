const https = require('https');

// Pega o HTML do Vercel e extrai info de build
https.get('https://cn-intelligence.vercel.app/', (res) => {
  let data = '';
  res.on('data', (c) => data += c);
  res.on('end', () => {
    // Pega todos os assets JS
    const matches = data.match(/assets\/index-[a-zA-Z0-9_-]+\.js/g);
    console.log('Assets encontrados:', [...new Set(matches)]);
    console.log('\nHeaders da resposta:', res.headers['x-vercel-id'] || 'sem vercel id');
    console.log('Cache status:', res.headers['x-vercel-cache'] || 'sem cache status');
  });
}).on('error', console.error);
