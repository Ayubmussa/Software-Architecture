const mongoose = require('mongoose');

/**
 * Read-model projection for order events consumed from RabbitMQ.
 * Independent from the order-service's MySQL store; used for fast analytics
 * lookups without joining across services.
 */
const orderEventSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      required: true,
      enum: ['order.placed'],
      index: true,
    },
    orderId: { type: Number, required: true, index: true },
    userId: { type: Number, index: true },
    totalAmount: { type: Number, default: 0 },
    status: { type: String },
    occurredAt: { type: Date, required: true, index: true },
    receivedAt: { type: Date, default: Date.now },
    payload: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

orderEventSchema.index({ eventType: 1, orderId: 1 }, { unique: true });

module.exports = mongoose.model('OrderEvent', orderEventSchema);
