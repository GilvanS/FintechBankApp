require('dotenv').config();

module.exports = {
  driver: process.env.EVENT_BUS_DRIVER || 'redis', // 'kafka' | 'redis' | 'memory'
  redis: {
    enabled: process.env.REDIS_ENABLED !== 'false', // default true (se false, usa memory)
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10)
  },
  kafka: {
    enabled: process.env.KAFKA_ENABLED === 'true', // default false
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID || 'fintech-api'
  }
};
