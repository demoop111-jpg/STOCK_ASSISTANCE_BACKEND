import express from 'express';
import User from '../models/User.js';
import { requireAdminKey } from '../middleware/auth.js';
import { hashPassword, safeUser } from '../utils/auth.js';

const router = express.Router();
router.use(requireAdminKey);

function cleanUsername(value = '') {
  return String(value || '').trim().toLowerCase();
}

function userResponse(user) {
  return {
    id: String(user._id),
    name: user.name,
    username: user.username,
    isActive: user.isActive !== false,
    lastLoginAt: user.lastLoginAt || null,
    lastLoginAtIST: user.lastLoginAtIST || '',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

router.get('/', async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).lean();
  res.json({ success: true, users: users.map(userResponse) });
});

router.post('/', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const username = cleanUsername(req.body.username);
    const password = String(req.body.password || '');

    if (name.length < 2) {
      return res.status(400).json({ success: false, message: 'Client name is required' });
    }
    if (!/^[a-z0-9_@.-]{3,50}$/.test(username)) {
      return res.status(400).json({ success: false, message: 'Username must be 3-50 characters and can include letters, numbers, _, @, . and -' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const passwordData = hashPassword(password);
    const user = await User.create({ name, username, ...passwordData, isActive: req.body.isActive !== false });
    res.status(201).json({ success: true, user: userResponse(user) });
  } catch (error) {
    const message = error.code === 11000 ? 'Username already exists' : error.message;
    res.status(500).json({ success: false, message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const update = {};
    if (req.body.name !== undefined) update.name = String(req.body.name || '').trim();
    if (req.body.username !== undefined) update.username = cleanUsername(req.body.username);
    if (req.body.isActive !== undefined) update.isActive = Boolean(req.body.isActive);

    if (req.body.password) {
      if (String(req.body.password).length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
      }
      Object.assign(update, hashPassword(req.body.password));
    }

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user: userResponse(user) });
  } catch (error) {
    const message = error.code === 11000 ? 'Username already exists' : error.message;
    res.status(500).json({ success: false, message });
  }
});

router.delete('/:id', async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, user: userResponse(user) });
});

export default router;
