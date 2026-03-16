// QZ Tray integration for silent label printing
// QZ Tray must be running on the local machine (https://qz.io)

const API = import.meta.env.VITE_API_URL || '/api'

let securityConfigured = false

function configureQZSecurity(q) {
  if (securityConfigured) return
  securityConfigured = true

  q.security.setCertificatePromise((resolve, reject) => {
    fetch(`${API}/qz/certificate`)
      .then(r => r.ok ? r.text() : Promise.reject(r.statusText))
      .then(resolve)
      .catch(reject)
  })

  q.security.setSignaturePromise((toSign) => (resolve, reject) => {
    fetch(`${API}/qz/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request: toSign }),
    })
      .then(r => r.json())
      .then(d => resolve(d.signature))
      .catch(reject)
  })
}

async function getConnectedQZ() {
  const q = window.qz
  if (!q) throw new Error('QZ Tray JS not loaded')

  // Always configure security BEFORE connecting
  configureQZSecurity(q)

  if (!q.websocket.isActive()) {
    await q.websocket.connect({ retries: 3, delay: 1 })
  }
  return q
}

export async function getPrinters() {
  const q = await getConnectedQZ()
  const result = await q.printers.find()
  if (!result) return []
  return Array.isArray(result) ? result : [result]
}

export async function printPdfBlob(printerName, blob) {
  const q = await getConnectedQZ()
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
