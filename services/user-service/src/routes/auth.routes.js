const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const User = require('../models/user.model');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();
const adminAuditLogs = [];

function writeAuditLog(actor, action, target, details = {}) {
  adminAuditLogs.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    actor: actor ? { id: actor.id, email: actor.email, role: actor.role } : null,
    action,
    target,
    details,
  });
  if (adminAuditLogs.length > 500) {
    adminAuditLogs.length = 500;
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
    const users = await User.find(filter).select('-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(limit);
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
    writeAuditLog(req.user, 'admin.user.update', `user:${user.id}`, { updates: { role, isActive, name, email } });
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
    writeAuditLog(req.user, 'admin.user.delete', `user:${req.params.id}`);
    return res.status(204).send();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error in DELETE /api/auth/admin/users/:id', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/admin/audit-logs', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const skip = Math.max(0, Number(req.query.skip) || 0);
    const limit = Math.min(300, Math.max(1, Number(req.query.limit) || 100));
    const filtered = q
      ? adminAuditLogs.filter((log) => JSON.stringify(log).toLowerCase().includes(q))
      : adminAuditLogs;
    return res.json(filtered.slice(skip, skip + limit));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error in GET /api/auth/admin/audit-logs', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;

