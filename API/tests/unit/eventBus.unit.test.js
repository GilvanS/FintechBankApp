const eventBus = require('../../services/eventBus');
const redisClient = require('../../services/redisClient');

describe('EventBus Service (Abstraction & Fallbacks)', () => {
  afterAll(async () => {
    await redisClient.disconnect();
  });

  test('deve publicar e receber evento via fallback in-memory/redis', (done) => {
    const testTopic = 'test.event.billing';
    const testPayload = { id: 123, amount: 99.90, status: 'declined' };

    eventBus.subscribe(testTopic, (data) => {
      expect(data).toEqual(testPayload);
      done();
    });

    eventBus.publish(testTopic, testPayload).then((result) => {
      expect(result).toHaveProperty('driver');
      expect(['memory', 'redis', 'kafka']).toContain(result.driver);
    });
  });
});
