const fs = require('fs');
const path = require('path');

const MAP_FILE = path.join(__dirname, '..', 'config', 'transport_map.json');

function getTransportMap() {
  try {
    const rows = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
    const map = {};
    for (const row of rows) {
      map[row.nextisName] = { shipperCode: row.shipperCode, serviceCode: row.serviceCode };
    }
    return map;
  } catch (err) {
    console.error('[TransportMap] Failed to load:', err.message);
    return {};
  }
}

function getTransportMapRows() {
  try {
    return JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveTransportMapRows(rows) {
  fs.writeFileSync(MAP_FILE, JSON.stringify(rows, null, 2));
}

module.exports = { getTransportMap, getTransportMapRows, saveTransportMapRows };
