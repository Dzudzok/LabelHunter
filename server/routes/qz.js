const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const PRIVATE_KEY_PATH = path.join(__dirname, '..', 'qz-private.pem')
const CERT_PATH = path.join(__dirname, '..', 'qz-certificate.pem')

// GET /qz/certificate — returns public key for QZ Tray verification
router.get('/certificate', (req, res) => {
  if (!fs.existsSync(CERT_PATH)) {
    return res.status(404).send('Certificate not found. Run: node server/scripts/generate-qz-cert.js')
  }
  res.type('text/plain').send(fs.readFileSync(CERT_PATH, 'utf8'))
})

// Load private key: from file (local dev) or env var (Render/production)
function getPrivateKey() {
  if (fs.existsSync(PRIVATE_KEY_PATH)) {
    return fs.readFileSync(PRIVATE_KEY_PATH, 'utf8')
  }
  if (process.env.QZ_PRIVATE_KEY) {
    return process.env.QZ_PRIVATE_KEY.replace(/\\n/g, '\n')
  }
  return null
}

// POST /qz/sign — signs request data with private key
router.post('/sign', (req, res) => {
  const { request } = req.body || {}
  if (!request) return res.status(400).json({ error: 'request required' })
  const privateKey = getPrivateKey()
  if (!privateKey) {
    return res.status(404).json({ error: 'Private key not configured. Set QZ_PRIVATE_KEY env var on Render.' })
  }
  try {
    const sign = crypto.createSign('SHA512')
    sign.update(request)
    const signature = sign.sign(privateKey, 'base64')
    res.json({ signature })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
