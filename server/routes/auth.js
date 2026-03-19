const express = require('express');
const router = express.Router();
const { generateToken } = require('../middleware/auth');

const SYSTEM_USER = process.env.SYSTEM_USER || 'admin';
const SYSTEM_PASSWORD = process.env.SYSTEM_PASSWORD || 'admin';

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (username !== SYSTEM_USER || password !== SYSTEM_PASSWORD) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = generateToken(username);
  res.json({ token, username });
});

// GET /api/auth/verify — check if current token is valid
router.get('/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ valid: false });
  }

  const jwt = require('jsonwebtoken');
  const { JWT_SECRET } = require('../middleware/auth');
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    res.json({ valid: true, username: decoded.sub });
  } catch {
    res.status(401).json({ valid: false });
  }
});

module.exports = router;
