#!/usr/bin/env node
/*
 * Seed the user-service MongoDB with a variety of demo users (1 admin + customers).
 *
 * Usage (from repo root):
 *   node scripts/seed_users.js
 *   node scripts/seed_users.js --reset   # delete demo users (by email) before seeding
 *
 * Reads MONGO_URI from services/user-service/.env (falls back to mongodb://localhost:27017/user-service).
 * Uses the same User model and bcrypt rounds as the user-service so registered users can log in normally.
 */

/* eslint-disable no-console */

const path = require('path');

const USER_SERVICE_DIR = path.resolve(__dirname, '..', 'services', 'user-service');
const USER_SERVICE_NODE_MODULES = path.join(USER_SERVICE_DIR, 'node_modules');

// Resolve user-service deps from the user-service's own node_modules so this
// script can run from the repo root without its own package.json.
function loadFromUserService(name) {
  return require(path.join(USER_SERVICE_NODE_MODULES, name));
}

const dotenv = loadFromUserService('dotenv');
const bcrypt = loadFromUserService('bcrypt');
const mongoose = loadFromUserService('mongoose');

dotenv.config({ path: path.join(USER_SERVICE_DIR, '.env') });

const User = require(path.join(USER_SERVICE_DIR, 'src', 'models', 'user.model'));

const MONGO_URI =
  process.env.MONGO_URI || 'mongodb://localhost:27017/user-service';

const DEFAULT_PASSWORD = 'Password123!';
const ADMIN_PASSWORD = 'Admin123!';

const USERS = [
  // ── Admin ────────────────────────────────────────────────────────────────
  {
    name: 'Site Admin',
    email: 'admin@shop.test',
    password: ADMIN_PASSWORD,
    role: 'admin',
  },
  // ── Customers ────────────────────────────────────────────────────────────
  { name: 'Alex Morgan',      email: 'alex.morgan@example.com',     password: DEFAULT_PASSWORD, role: 'customer' },
  { name: 'Sarah Khan',       email: 'sarah.khan@example.com',      password: DEFAULT_PASSWORD, role: 'customer' },
  { name: 'Mike Thompson',    email: 'mike.thompson@example.com',   password: DEFAULT_PASSWORD, role: 'customer' },
  { name: 'Emma Lopez',       email: 'emma.lopez@example.com',      password: DEFAULT_PASSWORD, role: 'customer' },
  { name: 'James Reilly',     email: 'james.reilly@example.com',    password: DEFAULT_PASSWORD, role: 'customer' },
  { name: 'Priya Patel',      email: 'priya.patel@example.com',     password: DEFAULT_PASSWORD, role: 'customer' },
  { name: 'Daniel Kim',       email: 'daniel.kim@example.com',      password: DEFAULT_PASSWORD, role: 'customer' },
  { name: 'Olivia Tanaka',    email: 'olivia.tanaka@example.com',   password: DEFAULT_PASSWORD, role: 'customer' },
  { name: 'Marcus Johnson',   email: 'marcus.j@example.com',        password: DEFAULT_PASSWORD, role: 'customer' },
  { name: 'Sophie Andersen',  email: 'sophie.a@example.com',        password: DEFAULT_PASSWORD, role: 'customer' },
  { name: 'Lisa Hernandez',   email: 'lisa.hernandez@example.com',  password: DEFAULT_PASSWORD, role: 'customer' },
  { name: 'Ryan Garcia',      email: 'ryan.garcia@example.com',     password: DEFAULT_PASSWORD, role: 'customer' },
  { name: 'Maria Silva',      email: 'maria.silva@example.com',     password: DEFAULT_PASSWORD, role: 'customer' },
  { name: 'Tom Becker',       email: 'tom.becker@example.com',      password: DEFAULT_PASSWORD, role: 'customer' },
  // Inactive demo account (to test the "Account is deactivated" flow)
  { name: 'Inactive User',    email: 'inactive@example.com',        password: DEFAULT_PASSWORD, role: 'customer', isActive: false },
];

async function nextOrderUserId() {
  const max = await User.findOne().sort({ orderUserId: -1 }).select('orderUserId').lean();
  return (max?.orderUserId ?? 0) + 1;
}

async function deleteSeedUsers() {
  const emails = USERS.map((u) => u.email);
  const result = await User.deleteMany({ email: { $in: emails } });
  return result.deletedCount || 0;
}

async function seed() {
  const args = process.argv.slice(2);
  const reset = args.includes('--reset');

  console.log(`Connecting to MongoDB: ${MONGO_URI}`);
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  console.log('Connected.');

  if (reset) {
    const n = await deleteSeedUsers();
    console.log(`Deleted ${n} existing seed user(s).`);
  }

  let created = 0;
  let skipped = 0;
  let nextId = await nextOrderUserId();

  for (const u of USERS) {
    const email = u.email.toLowerCase();
    const existing = await User.findOne({ email }).lean();
    if (existing) {
      console.log(`  Skip (exists): ${email}`);
      skipped++;
      continue;
    }

    const passwordHash = await bcrypt.hash(u.password, 10);
    const doc = {
      email,
      passwordHash,
      name: u.name,
      role: u.role || 'customer',
      isActive: u.isActive !== false,
      orderUserId: nextId++,
      wishlistProductIds: [],
    };

    try {
      const created_user = await User.create(doc);
      created++;
      const roleTag = doc.role === 'admin' ? '[ADMIN]' : '       ';
      const activeTag = doc.isActive ? '' : ' (inactive)';
      console.log(
        `  Created ${roleTag} #${created_user.orderUserId}: ${doc.name} <${doc.email}>${activeTag}`,
      );
    } catch (err) {
      console.error(`  ERROR creating ${email}: ${err.message}`);
    }
  }

  console.log();
  console.log(`Done: ${created} user(s) created, ${skipped} skipped.`);
  console.log();
  console.log('Demo credentials:');
  console.log(`  Admin     -> admin@shop.test    /  ${ADMIN_PASSWORD}`);
  console.log(`  Customers -> *@example.com      /  ${DEFAULT_PASSWORD}`);

  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error('Seeding failed:', err);
  try {
    await mongoose.disconnect();
  } catch {
    /* noop */
  }
  process.exit(1);
});
