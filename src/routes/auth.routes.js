import express from 'express';
import User from '../models/User.js';
import { getIndianDateTime, signToken, verifyPassword, safeUser } from '../utils/auth.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    const user = await User.findOne({ username });
    if (!user || user.isActive === false || !verifyPassword(password, user)) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    const now = new Date();
    user.lastLoginAt = now;
    user.lastLoginAtIST = getIndianDateTime(now);
    await user.save();

    const token = signToken(user);
    res.json({ success: true, token, user: safeUser(user) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Login failed', error: error.message });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ success: true, user: req.user });
});

export default router;
