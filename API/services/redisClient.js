const Redis = require('ioredis');
const config = require('../config/eventBus.config');

let client = null;
let publisher = null;
let subscriber = null;
let isReady = false;

if (config.redis.enabled) {
  const redisOpts = {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db,
    retryStrategy(times) {
      if (times > 5) return null;
      return Math.min(times * 500, 2000);
    },
    lazyConnect: true,
    maxRetriesPerRequest: 1
  };

  client = new Redis(redisOpts);

  client.on('connect', () => {
    isReady = true;
  });

  client.on('error', () => {
    isReady = false;
  });

  client.connect().catch(() => {});
}

function createPubSubClient() {
  if (!config.redis.enabled) return null;
  const pubSubOpts = {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db,
    lazyConnect: true
  };
  const c = new Redis(pubSubOpts);
  c.on('error', () => {});
  c.connect().catch(() => {});
  return c;
}

function getPublisher() {
  if (!publisher && config.redis.enabled) {
    publisher = createPubSubClient();
  }
  return publisher;
}

function getSubscriber() {
  if (!subscriber && config.redis.enabled) {
    subscriber = createPubSubClient();
  }
  return subscriber;
}

async function disconnect() {
  isReady = false;
  if (client) { try { await client.quit(); } catch(e){} }
  if (publisher) { try { await publisher.quit(); } catch(e){} }
  if (subscriber) { try { await subscriber.quit(); } catch(e){} }
}

module.exports = {
  getClient: () => client,
  getPublisher,
  getSubscriber,
  disconnect,
  isReady: () => isReady && client && client.status === 'ready'
};
