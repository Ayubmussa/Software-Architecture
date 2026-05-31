const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const crypto = require('crypto');

const authRoutes = require('./routes/auth.routes');
const orderEventConsumer = require('./events/orderEventConsumer');

dotenv.config();

const app = express();

app.use(cors());
app.use((req, res, next) => {
  const incoming = req.header('x-request-id');
  const requestId = incoming && incoming.trim() ? incoming.trim().slice(0, 128) : crypto.randomUUID();
  const startedAt = Date.now();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  res.on('finish', () => {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
      service: 'user-service',
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    }));
  });
  next();
});
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'user-service' });
});

app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 4001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/user-service';

async function start() {
  try {
    await mongoose.connect(MONGO_URI);
    // eslint-disable-next-line no-console
    console.log('Connected to MongoDB for user-service');

    // Background event projection (no-op if RABBIT_URL not set or broker is down)
    orderEventConsumer.start().catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('order-events consumer failed to start:', err.message);
    });

    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`User service listening on port ${PORT}`);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to start user-service', err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  start();
}

module.exports = app;

