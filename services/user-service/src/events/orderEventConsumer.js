/* eslint-disable no-console */
const amqp = require('amqplib');

const OrderEvent = require('../models/orderEvent.model');

const QUEUE_NAME = process.env.ORDER_EVENTS_QUEUE || 'order.placed';
const DLQ_NAME = process.env.ORDER_EVENTS_DLQ || `${QUEUE_NAME}.dlq`;
const RABBIT_URL = process.env.RABBIT_URL || process.env.RABBITMQ_URL;
const RECONNECT_DELAY_MS = 5000;

let connection = null;
let channel = null;
let stopping = false;

async function persistOrderPlaced(payload) {
  if (!payload || typeof payload.orderId === 'undefined') return;
  const orderId = Number(payload.orderId);
  if (!Number.isFinite(orderId)) return;

  const userId = payload.userId != null ? Number(payload.userId) : null;
  const totalAmount = payload.totalAmount != null ? Number(payload.totalAmount) : 0;
  const status = typeof payload.status === 'string' ? payload.status : null;
  const occurredAt = payload.createdAt ? new Date(payload.createdAt) : new Date();

  await OrderEvent.updateOne(
    { eventType: 'order.placed', orderId },
    {
      $set: {
        eventType: 'order.placed',
        orderId,
        userId,
        totalAmount,
        status,
        occurredAt,
        payload,
      },
      $setOnInsert: { receivedAt: new Date() },
    },
    { upsert: true }
  );
}

async function connect() {
  if (stopping) return;
  if (!RABBIT_URL) {
    console.log('[order-events] RABBIT_URL not set; consumer disabled.');
    return;
  }

  try {
    connection = await amqp.connect(RABBIT_URL);
    channel = await connection.createChannel();
    await channel.assertQueue(DLQ_NAME, { durable: true });
    await channel.assertQueue(QUEUE_NAME, {
      durable: true,
      deadLetterExchange: '',
      deadLetterRoutingKey: DLQ_NAME,
    });
    channel.prefetch(16);

    console.log(`[order-events] consuming "${QUEUE_NAME}" from ${RABBIT_URL}`);

    channel.consume(
      QUEUE_NAME,
      async (msg) => {
        if (!msg) return;
        try {
          const text = msg.content.toString('utf8');
          const payload = JSON.parse(text);
          await persistOrderPlaced(payload);
          channel.ack(msg);
        } catch (err) {
          console.error('[order-events] failed to handle message; sent to DLQ', err);
          try { channel.nack(msg, false, false); } catch { /* ignore */ }
        }
      },
      { noAck: false }
    );

    connection.on('close', () => {
      if (stopping) return;
      console.warn('[order-events] connection closed; retrying...');
      channel = null;
      connection = null;
      setTimeout(connect, RECONNECT_DELAY_MS);
    });
    connection.on('error', (err) => {
      console.warn('[order-events] connection error:', err.message);
    });
  } catch (err) {
    console.warn(
      `[order-events] could not connect to ${RABBIT_URL} (${err.message}); retrying in ${RECONNECT_DELAY_MS}ms`
    );
    channel = null;
    connection = null;
    setTimeout(connect, RECONNECT_DELAY_MS);
  }
}

async function start() {
  stopping = false;
  await connect();
}

async function stop() {
  stopping = true;
  try { if (channel) await channel.close(); } catch { /* ignore */ }
  try { if (connection) await connection.close(); } catch { /* ignore */ }
  channel = null;
  connection = null;
}

module.exports = { start, stop, QUEUE_NAME };
