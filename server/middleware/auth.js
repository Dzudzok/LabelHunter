const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// JWT secret: from env or random (random means tokens invalidate on restart)
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const JWT_EXPIRY = '24h';

/**
 * Generate JWT token for authenticated user
 */
function generateToken(username) {
  return jwt.sign({ sub: username, iat: Math.floor(Date.now() / 1000) }, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
  });
}

/**
 * Middleware that checks JWT on protected routes.
 * Skips auth for public paths.
 */
function requireAuth(req, res, next) {
  // Public paths — skip auth
  const publicPrefixes = [
    '/api/packages/public',
    '/api/qz',
    '/api/auth',
    '/api/tracking',
    '/api/health',
    '/labels',
  ];

  const isPublic = publicPrefixes.some(prefix => req.path.startsWith(prefix));
  if (isPublic) return next();

  // Only protect /api/* routes (skip static files etc.)
  if (!req.path.startsWith('/api/')) return next();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.authUser = decoded.sub;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { generateToken, requireAuth, JWT_SECRET };
