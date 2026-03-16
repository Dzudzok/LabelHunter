// QZ Tray integration for silent label printing
// QZ Tray must be running on the local machine (https://qz.io)
// Requires "Block anonymous requests" to be UNCHECKED in QZ Tray tray menu

function getQZ() {
  if (!window.qz) throw new Error('QZ Tray JS not loaded')
  return window.qz
}

async function ensureConnected() {
  const q = getQZ()
  if (q.websocket.isActive()) return q
  q.security.setCertificatePromise(() => Promise.resolve(''))
  q.security.setSignaturePromise(() => Promise.resolve(''))
  await q.websocket.connect({ retries: 3, delay: 1 })
  return q
}

export async function getPrinters() {
  const q = await ensureConnected()
  const result = await q.printers.find()
  if (!result) return []
  return Array.isArray(result) ? result : [result]
}

export async function printPdfBlob(printerName, blob) {
  const q = await ensureConnected()
  const base64 = await blobToBase64(blob)
  const config = q.configs.create(printerName)
  const data = [{ type: 'pixel', format: 'pdf', flavor: 'base64', data: base64 }]
  await q.print(config, data)
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

export function isQZConnected() {
  return !!window.qz && window.qz.websocket.isActive()
}
