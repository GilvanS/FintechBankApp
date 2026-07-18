const http = require('http');

http.get('http://localhost:3001/auth/me', { headers: { 'Authorization': 'Bearer ' + process.argv[2] } }, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const user = JSON.parse(data);
      console.log('CLOSED TXS:', user.creditCard.closedTransactions);
    } catch(e) {
      console.log(data);
    }
  });
});
