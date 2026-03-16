/**
 * Generates X.509 certificate + private key for QZ Tray signing.
 * Run: node server/scripts/generate-qz-cert.js
 */
const { execSync, spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const outDir = path.join(__dirname, '..')
const keyPath = path.join(outDir, 'qz-private.pem')
const certPath = path.join(outDir, 'qz-certificate.pem')

// Find openssl (Git for Windows ships it)
const candidates = [
  'openssl',
  'C:\\Program Files\\Git\\usr\\bin\\openssl.exe',
  'C:\\Program Files (x86)\\Git\\usr\\bin\\openssl.exe',
]

let opensslBin = null
for (const c of candidates) {
  try {
    execSync(`"${c}" version`, { stdio: 'ignore' })
    opensslBin = c
    break
  } catch {}
}

if (!opensslBin) {
  console.error('ERROR: openssl not found. Install Git for Windows (https://git-scm.com) or add openssl to PATH.')
  process.exit(1)
}

console.log(`Using openssl: ${opensslBin}`)

const cmd = `"${opensslBin}" req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 3650 -nodes -subj "/CN=LabelHunter/O=MROAUTO/C=CZ"`
execSync(cmd, { stdio: 'inherit' })

console.log('')
console.log('✓ Generated:')
console.log('   server/qz-private.pem  (keep secret, used by server to sign)')
console.log('   server/qz-certificate.pem  (add to QZ Tray Site Manager)')
console.log('')
console.log('Next steps:')
console.log('  1. QZ Tray icon → Site Manager → Browse → select qz-certificate.pem')
console.log('  2. Deploy server (git push)')
console.log('  3. Reload LabelHunter → Tiskárna → Načíst tiskárny')
