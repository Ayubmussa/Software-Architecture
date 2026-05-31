const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const User = require('../models/user.model');
const OrderEvent = require('../models/orderEvent.model');
const AuditLog = require('../models/auditLog.model');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

async function writeAuditLog(actor, action, target, details = {}, requestId) {
  try {
    await AuditLog.create({
      actor: actor
        ? { id: String(actor.id || ''), email: actor.email, role: actor.role }
        : null,
      action,
      target,
      details: details ?? {},
      requestId: requestId || undefined,
    });
  } catch (err) {
    // Never break the calling request if audit logging itself fails.
    // eslint-disable-next-line no-console
    console.warn('writeAuditLog failed:', err.message);
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  return next();
}

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ message: 'name, email and password are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const maxUser = await User.findOne().sort({ orderUserId: -1 }).select('orderUserId').lean();
    const orderUserId = (maxUser?.orderUserId ?? 0) + 1;

    const user = await User.create({ email, passwordHash, name, orderUserId });

    return res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      orderUserId: user.orderUserId,
      wishlistProductIds: user.wishlistProductIds ?? [],
      createdAt: user.createdAt,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error in /api/auth/register', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ message: 'JWT secret not configured' });
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      orderUserId: user.orderUserId,
    };

    const token = jwt.sign(payload, secret, { expiresIn: '1h' });

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        orderUserId: user.orderUserId,
        wishlistProductIds: user.wishlistProductIds ?? [],
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error in /api/auth/login', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.orderUserId == null) {
      const maxUser = await User.findOne().sort({ orderUserId: -1 }).select('orderUserId').lean();
      user.orderUserId = (maxUser?.orderUserId ?? 0) + 1;
      await user.save();
    }
    return res.json(user);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error in /api/auth/me', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.patch('/me', authMiddleware, async (req, res) => {
  try {
    const { name, email } = req.body;
    const user = await User.findById(req.user.id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (name != null && typeof name === 'string' && name.trim()) {
      user.name = name.trim();
    }
    if (email != null && typeof email === 'string' && email.trim()) {
      const trimmed = email.trim().toLowerCase();
      if (trimmed !== user.email) {
        const existing = await User.findOne({ email: trimmed });
        if (existing) {
          return res.status(409).json({ message: 'Email already in use' });
        }
        user.email = trimmed;
      }
    }
    await user.save();
    return res.json(user);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error in PATCH /api/auth/me', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/wishlist', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('wishlistProductIds');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.json({ wishlistProductIds: user.wishlistProductIds ?? [] });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error in GET /api/auth/wishlist', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/wishlist/:productId', authMiddleware, async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ message: 'Invalid productId' });
    }
    const user = await User.findById(req.user.id).select('wishlistProductIds');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (!user.wishlistProductIds.includes(productId)) {
      user.wishlistProductIds.push(productId);
      await user.save();
    }
    return res.json({ wishlistProductIds: user.wishlistProductIds });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error in POST /api/auth/wishlist/:productId', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/wishlist/:productId', authMiddleware, async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ message: 'Invalid productId' });
    }
    const user = await User.findById(req.user.id).select('wishlistProductIds');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    user.wishlistProductIds = (user.wishlistProductIds ?? []).filter((id) => id !== productId);
    await user.save();
    return res.json({ wishlistProductIds: user.wishlistProductIds });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error in DELETE /api/auth/wishlist/:productId', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/admin/users', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const skip = Math.max(0, Number(req.query.skip) || 0);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const filter = q
      ? {
          $or: [
            { email: { $regex: q, $options: 'i' } },
            { name: { $regex: q, $options: 'i' } },
            { role: { $regex: q, $options: 'i' } },
          ],
        }
      : {};
    const [users, total] = await Promise.all([
      User.find(filter).select('-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);
    res.set('X-Total-Count', String(total));
    return res.json(users);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error in GET /api/auth/admin/users', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.patch('/admin/users/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const { role, isActive, name, email } = req.body;
    if (role != null) {
      if (!['customer', 'admin'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role' });
      }
      user.role = role;
    }
    if (typeof isActive === 'boolean') {
      user.isActive = isActive;
    }
    if (name != null && typeof name === 'string' && name.trim()) {
      user.name = name.trim();
    }
    if (email != null && typeof email === 'string' && email.trim()) {
      const trimmed = email.trim().toLowerCase();
      const existing = await User.findOne({ email: trimmed });
      if (existing && existing.id !== user.id) {
        return res.status(409).json({ message: 'Email already in use' });
      }
      user.email = trimmed;
    }
    await user.save();
    await writeAuditLog(
      req.user,
      'admin.user.update',
      `user:${user.id}`,
      { updates: { role, isActive, name, email } },
      req.requestId
    );
    return res.json(user);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error in PATCH /api/auth/admin/users/:id', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/admin/users/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (String(user._id) === String(req.user.id)) {
      return res.status(400).json({ message: 'Cannot delete your own admin account' });
    }
    await user.deleteOne();
    await writeAuditLog(req.user, 'admin.user.delete', `user:${req.params.id}`, {}, req.requestId);
    return res.status(204).send();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error in DELETE /api/auth/admin/users/:id', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/admin/analytics/orders', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const sinceDays = Math.min(180, Math.max(1, Number(req.query.days) || 30));
    const sinceDate = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

    const [totals, daily, topUsersRaw, recent] = await Promise.all([
      OrderEvent.aggregate([
        { $match: { eventType: 'order.placed' } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalRevenue: { $sum: { $ifNull: ['$totalAmount', 0] } },
            uniqueUsers: { $addToSet: '$userId' },
          },
        },
        {
          $project: {
            _id: 0,
            totalOrders: 1,
            totalRevenue: 1,
            uniqueUsers: { $size: '$uniqueUsers' },
          },
        },
      ]),
      OrderEvent.aggregate([
        { $match: { eventType: 'order.placed', occurredAt: { $gte: sinceDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$occurredAt' } },
            orders: { $sum: 1 },
            revenue: { $sum: { $ifNull: ['$totalAmount', 0] } },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, day: '$_id', orders: 1, revenue: 1 } },
      ]),
      OrderEvent.aggregate([
        { $match: { eventType: 'order.placed', userId: { $ne: null } } },
        {
          $group: {
            _id: '$userId',
            orders: { $sum: 1 },
            revenue: { $sum: { $ifNull: ['$totalAmount', 0] } },
          },
        },
        { $sort: { revenue: -1, orders: -1 } },
        { $limit: 5 },
      ]),
      OrderEvent.find({ eventType: 'order.placed' })
        .sort({ occurredAt: -1 })
        .limit(10)
        .lean(),
    ]);

    const summary = totals[0] || { totalOrders: 0, totalRevenue: 0, uniqueUsers: 0 };

    let topUsers = topUsersRaw.map((u) => ({
      orderUserId: u._id,
      orders: u.orders,
      revenue: u.revenue,
      name: null,
      email: null,
    }));

    if (topUsers.length > 0) {
      const ids = topUsers.map((u) => u.orderUserId).filter((id) => id != null);
      if (ids.length > 0) {
        const users = await User.find({ orderUserId: { $in: ids } })
          .select('name email orderUserId')
          .lean();
        const byId = new Map(users.map((u) => [u.orderUserId, u]));
        topUsers = topUsers.map((u) => {
          const user = byId.get(u.orderUserId);
          return user ? { ...u, name: user.name, email: user.email } : u;
        });
      }
    }

    return res.json({
      summary: {
        totalOrders: summary.totalOrders || 0,
        totalRevenue: summary.totalRevenue || 0,
        uniqueUsers: summary.uniqueUsers || 0,
        windowDays: sinceDays,
      },
      daily,
      topUsers,
      recent: recent.map((r) => ({
        orderId: r.orderId,
        userId: r.userId,
        totalAmount: r.totalAmount,
        status: r.status,
        occurredAt: r.occurredAt,
      })),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error in GET /api/auth/admin/analytics/orders', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/admin/audit-logs', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const skip = Math.max(0, Number(req.query.skip) || 0);
    const limit = Math.min(300, Math.max(1, Number(req.query.limit) || 100));

    let filter = {};
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter = {
        $or: [
          { action: rx },
          { target: rx },
          { 'actor.email': rx },
          { 'actor.role': rx },
        ],
      };
    }

    const [docs, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter),
    ]);

    const items = docs.map((d) => ({
      id: String(d._id),
      createdAt: d.createdAt,
      actor: d.actor || null,
      action: d.action,
      target: d.target,
      details: d.details ?? {},
      requestId: d.requestId || null,
    }));

    res.set('X-Total-Count', String(total));
    return res.json(items);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error in GET /api/auth/admin/audit-logs', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Internal endpoint used by the gateway (or other admin-authenticated callers)
// to record audit entries for admin actions performed against any service.
router.post('/admin/audit-logs', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { action, target, details } = req.body || {};
    if (!action || !target) {
      return res.status(400).json({ message: 'action and target are required' });
    }
    await writeAuditLog(req.user, String(action), String(target), details || {}, req.requestId);
    return res.status(201).json({ ok: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error in POST /api/auth/admin/audit-logs', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;

