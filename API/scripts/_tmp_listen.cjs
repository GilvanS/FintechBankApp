const eventBus = require('../services/eventBus');
(async () => {
  await eventBus.subscribe('mass.created', (p) => {
    console.log('EVENTO_RECEBIDO:', JSON.stringify(p));
    process.exit(0);
  });
  console.log('ESCUTANDO mass.created por 20s...');
  setTimeout(() => { console.log('TIMEOUT_SEM_EVENTO'); process.exit(1); }, 20000);
})();
