// QZ Tray integration for silent label printing
// QZ Tray must be running on the local machine (https://qz.io)

let qz = null
let connected = false

async function loadQZ() {
  if (qz) return qz
  // QZ Tray JS is loaded via CDN in index.html as window.qz
  if (window.qz) {
    qz = window.qz
    return qz
  }
  throw new Error('QZ Tray JS not loaded')
}

export async function connectQZ() {
  const q = await loadQZ()
  if (q.websocket.isActive()) { connected = true; return }
  // Disable certificate check for self-signed/unsigned
  q.security.setCertificatePromise(() => Promise.resolve(''))
  q.security.setSignatureAlgorithm('SHA512')
  q.security.setSignaturePromise(() => Promise.resolve(''))
  await q.websocket.connect({ retries: 1, delay: 0 })
  connected = true
}

export async function disconnectQZ() {
  if (!qz || !connected) return
  try { await qz.websocket.disconnect() } catch {}
  connected = false
}

export async function getPrinters() {
  await connectQZ()
  return await qz.printers.find()
}

export async function printPdfBlob(printerName, blob) {
  await connectQZ()
  const base64 = await blobToBase64(blob)
  const config = qz.configs.create(printerName)
  const data = [{ type: 'pixel', format: 'pdf', flavor: 'base64', data: base64 }]
  await qz.print(config, data)
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export function isQZAvailable() {
  return !!window.qz
}
