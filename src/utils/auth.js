import crypto from 'crypto';

const TOKEN_TTL_SECONDS = Number(process.env.AUTH_TOKEN_TTL_SECONDS || 60 * 60 * 24 * 7);

function secret() {
  return process.env.AUTH_SECRET || process.env.JWT_SECRET || 'change-this-auth-secret';
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function fromBase64url(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

export function hashPassword(password = '', salt = crypto.randomBytes(16).toString('hex')) {
  const passwordHash = crypto
    .pbkdf2Sync(String(password), salt, 120000, 64, 'sha512')
    .toString('hex');
  return { passwordSalt: salt, passwordHash };
}

export function verifyPassword(password = '', user = {}) {
  if (!user.passwordSalt || !user.passwordHash) return false;
  const { passwordHash } = hashPassword(String(password), user.passwordSalt);
  return crypto.timingSafeEqual(Buffer.from(passwordHash), Buffer.from(user.passwordHash));
}

export function signToken(user = {}) {
  const payload = {
    sub: String(user._id || user.id || ''),
    name: user.name || '',
    username: user.username || '',
    salesPersonMobile: user.salesPersonMobile || '',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
  };

  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', secret())
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

export function verifyToken(token = '') {
  const [encodedPayload, signature] = String(token || '').split('.');
  if (!encodedPayload || !signature) return null;

  const expected = crypto
    .createHmac('sha256', secret())
    .update(encodedPayload)
    .digest('base64url');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  const payload = JSON.parse(fromBase64url(encodedPayload));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function getIndianDateTime(date = new Date()) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(date);
}

export function safeUser(user = {}) {
  return {
    id: String(user._id || user.id || user.sub || ''),
    name: user.name || '',
    username: user.username || '',
    salesPersonMobile: user.salesPersonMobile || ''
  };
}
