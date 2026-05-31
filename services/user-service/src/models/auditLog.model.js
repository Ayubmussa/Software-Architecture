const mongoose = require('mongoose');

/**
 * Persistent admin audit log.
 * Records actions performed by admins across services; survives user-service restarts.
 */
const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      id: { type: String },
      email: { type: String },
      role: { type: String },
    },
    action: { type: String, required: true, index: true },
    target: { type: String, required: true, index: true },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    requestId: { type: String, index: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
