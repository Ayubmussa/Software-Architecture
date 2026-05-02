const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['customer', 'admin'],
      default: 'customer',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    orderUserId: {
      type: Number,
      unique: true,
      sparse: true,
    },
    wishlistProductIds: {
      type: [Number],
      default: [],
    },
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

module.exports = User;

