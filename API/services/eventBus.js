const EventEmitter = require('events');
const config = require('../config/eventBus.config');
const redisClient = require('./redisClient');

const localBus = new EventEmitter();
let kafkaProducer = null;
let kafkaConsumer = null;

// Inicialização opcional do Kafka se habilitado
if (config.kafka.enabled) {
  try {
    const { Kafka } = require('kafkajs');
    const kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers
    });
    kafkaProducer = kafka.producer();
    kafkaProducer.connect().catch((err) => {
      console.warn('[Kafka] Falha ao conectar Producer:', err.message);
      kafkaProducer = null;
    });
  } catch (err) {
    console.warn('[Kafka] kafkajs não pôde ser inicializado:', err.message);
  }
}

/**
 * Publica um evento num tópico
 * @param {string} topic - Nome do tópico ou canal
 * @param {object} payload - Dados do evento
 */
async function publish(topic, payload) {
  const dataString = typeof payload === 'string' ? payload : JSON.stringify(payload);

  // 1. Tentar Kafka se ativo e pronto
  if (config.kafka.enabled && kafkaProducer) {
    try {
      await kafkaProducer.send({
        topic,
        messages: [{ value: dataString }]
      });
      return { driver: 'kafka' };
    } catch (err) {
      console.warn(`[EventBus] Queda no Kafka ao publicar em ${topic}, caindo para Redis/Memory:`, err.message);
    }
  }

  // 2. Tentar Redis Pub/Sub
  const pub = redisClient.getPublisher();
  if (pub && redisClient.isReady()) {
    try {
      await pub.publish(topic, dataString);
      return { driver: 'redis' };
    } catch (err) {
      console.warn(`[EventBus] Queda no Redis ao publicar em ${topic}, caindo para in-memory:`, err.message);
    }
  }

  // 3. Fallback in-memory (EventEmitter)
  localBus.emit(topic, payload);
  return { driver: 'memory' };
}

/**
 * Inscreve um handler em um tópico
 * @param {string} topic - Nome do tópico ou canal
 * @param {function} handler - Função callback(payload)
 */
async function subscribe(topic, handler) {
  // Sempre registra no EventEmitter local (garante entrega local)
  localBus.on(topic, (data) => {
    try {
      handler(typeof data === 'string' ? JSON.parse(data) : data);
    } catch (err) {
      handler(data);
    }
  });

  // Se Redis estiver disponível, se inscreve no canal Pub/Sub
  const sub = redisClient.getSubscriber();
  if (sub) {
    try {
      await sub.subscribe(topic);
      sub.on('message', (channel, message) => {
        if (channel === topic) {
          try {
            const parsed = JSON.parse(message);
            handler(parsed);
          } catch (e) {
            handler(message);
          }
        }
      });
    } catch (err) {
      console.warn(`[EventBus] Falha ao inscrever Redis no tópico ${topic}:`, err.message);
    }
  }
}

module.exports = {
  publish,
  subscribe,
  localBus
};
