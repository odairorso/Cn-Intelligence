const https = require('https');
https.get('https://cn-intelligence.vercel.app/', (res) => {
  let data = '';
  res.on('data', (c) => data += c);
  res.on('end', () => {
    const match = data.match(/assets\/index-[a-zA-Z0-9_-]+\.js/);
    if (match) {
      const url = 'https://cn-intelligence.vercel.app/' + match[0];
      console.log('Found:', url);
      https.get(url, (res2) => {
        let jsData = '';
        res2.on('data', (c) => jsData += c);
        res2.on('end', () => {
          console.log('JS Contains fix?', jsData.includes('showPayBatchModal[0].vencimento'));
          console.log('JS Contains old?', jsData.includes('SelectBankModal,{transactionId:"batch"'));
        });
      });
    } else {
      console.log('No assets found', data);
    }
  });
});
