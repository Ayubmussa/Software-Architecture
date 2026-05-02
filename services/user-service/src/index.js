const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth.routes');

dotenv.config();

const app = express();

app.use(cors());
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

