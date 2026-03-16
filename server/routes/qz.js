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

// POST /qz/sign — signs request data with private key
router.post('/sign', (req, res) => {
  const { request } = req.body || {}
  if (!request) return res.status(400).json({ error: 'request required' })
  if (!fs.existsSync(PRIVATE_KEY_PATH)) {
    return res.status(404).json({ error: 'Private key not found. Run: node server/scripts/generate-qz-cert.js' })
  }
  try {
    const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8')
    const sign = crypto.createSign('SHA512')
    sign.update(request)
    const signature = sign.sign(privateKey, 'base64')
    res.json({ signature })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
