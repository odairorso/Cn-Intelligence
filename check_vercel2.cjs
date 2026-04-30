const https = require('https');
https.get('https://cn-intelligence.vercel.app/', (res) => {
  let data = '';
  res.on('data', (c) => data += c);
  res.on('end', () => {
    const match = data.match(/assets\/index-[a-zA-Z0-9_-]+\.js/);
    if (match) {
      const url = 'https://cn-intelligence.vercel.app/' + match[0];
      https.get(url, (res2) => {
        let jsData = '';
        res2.on('data', (c) => jsData += c);
        res2.on('end', () => {
          // find where transactionId:"batch" is
          const idx = jsData.indexOf('transactionId:"batch"');
          console.log('Found transactionId:"batch" at', idx);
          console.log('Surrounding code:', jsData.slice(idx - 100, idx + 200));
        });
      });
    }
  });
});
