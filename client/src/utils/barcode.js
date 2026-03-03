// Classify scanned code type
export function classifyBarcode(code) {
  if (code.startsWith('ACTION:')) {
    const parts = code.split(':')
    return { type: 'action', action: parts[1], param: parts[2] }
  }
  // Invoice numbers are typically 8-digit numbers
  if (/^\d{8}$/.test(code)) {
    return { type: 'invoice', value: code }
  }
  return { type: 'product', value: code }
}

// Generate action barcode value
export function actionBarcode(action, param) {
  return `ACTION:${action}${param ? ':' + param : ''}`
}
