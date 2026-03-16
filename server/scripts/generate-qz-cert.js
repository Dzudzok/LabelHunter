/**
 * Generates RSA key pair for QZ Tray signing.
 * Run once: node server/scripts/generate-qz-cert.js
 *
 * Then add server/qz-certificate.pem to QZ Tray Site Manager.
 */
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

// QZ Tray accepts raw public key PEM (SPKI) as "certificate"
const outDir = path.join(__dirname, '..')
fs.writeFileSync(path.join(outDir, 'qz-private.pem'), privateKey)
fs.writeFileSync(path.join(outDir, 'qz-certificate.pem'), publicKey)

console.log('✓ Generated qz-private.pem and qz-certificate.pem in /server/')
console.log('')
console.log('Next step: add qz-certificate.pem to QZ Tray Site Manager:')
console.log('  1. Right-click QZ Tray icon → Site Manager')
console.log('  2. Click Browse... → select server/qz-certificate.pem')
console.log('  3. Close Site Manager')
console.log('  4. Reload LabelHunter → Načíst tiskárny')
