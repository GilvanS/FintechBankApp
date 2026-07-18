const http = require('http');

http.get('http://localhost:3001/users/11111111111', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const user = JSON.parse(data);
      console.log('CLOSED TXS:', user.creditCard.closedTransactions);
      console.log('ALL TXS LENGTH:', user.creditCard.transactions.length);
      console.log('OPEN TXS LENGTH:', user.creditCard.transactions.length);
    } catch(e) {
      console.log(data);
    }
  });
});
