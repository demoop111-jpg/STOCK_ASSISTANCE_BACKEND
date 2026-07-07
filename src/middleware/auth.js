import User from '../models/User.js';
import { verifyToken, safeUser } from '../utils/auth.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const payload = verifyToken(token);

    if (!payload?.sub) {
      return res.status(401).json({ success: false, message: 'Login required' });
    }

    const user = await User.findById(payload.sub).lean();
    if (!user || user.isActive === false) {
      return res.status(401).json({ success: false, message: 'User is not active or does not exist' });
    }

    req.user = safeUser(user);
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid login session' });
  }
}

export async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const payload = verifyToken(token);
    if (payload?.sub) {
      const user = await User.findById(payload.sub).lean();
      if (user && user.isActive !== false) req.user = safeUser(user);
    }
  } catch (error) {
    // Optional auth should never block public read routes.
  }
  next();
}

export function requireAdminKey(req, res, next) {
  const expected = process.env.ADMIN_KEY || process.env.USER_MANAGEMENT_KEY || 'stock_admin_2026';
  const provided = req.headers['x-admin-key'] || req.body.adminKey || req.query.adminKey;

  if (!provided || String(provided) !== String(expected)) {
    return res.status(401).json({ success: false, message: 'Valid admin key is required' });
  }

  next();
}
