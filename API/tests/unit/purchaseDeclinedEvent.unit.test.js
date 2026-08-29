const eventBus = require('../../services/eventBus');
const redisClient = require('../../services/redisClient');

describe('Task 3 — purchase.declined async event', () => {
  afterAll(async () => {
    await redisClient.disconnect();
  });

  test('deve emitir e capturar evento purchase.declined', (done) => {
    const payload = {
      cpf: '12345678900',
      requiredAmount: 500.00,
      availableLimit: 100.00,
      reason: 'limite_insuficiente',
      type: 'credit'
    };

    eventBus.subscribe('purchase.declined', (data) => {
      expect(data.cpf).toBe('12345678900');
      expect(data.requiredAmount).toBe(500.00);
      expect(data.reason).toBe('limite_insuficiente');
      done();
    });

    eventBus.publish('purchase.declined', payload);
  });
});
