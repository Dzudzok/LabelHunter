const sql = require('mssql');

const config = {
  server: (process.env.LP_MSSQL_SERVER || '').replace(/\\\\/g, '\\'),
  database: process.env.LP_MSSQL_DATABASE || 'label_printer',
  user: process.env.LP_MSSQL_USER || '',
  password: process.env.LP_MSSQL_PASSWORD || '',
  options: {
    encrypt: false,
    trustServerCertificate: process.env.LP_MSSQL_TRUST_CERT === 'true',
    instanceName: undefined,
  },
  connectionTimeout: 30000,
  requestTimeout: 60000,
};

// Extract instance name from server string (e.g. "BOLOPC\SQLEXPRESS01")
const parts = config.server.split('\\');
if (parts.length > 1) {
  config.server = parts[0];
  config.options.instanceName = parts[1];
}

let pool = null;

async function getPool() {
  if (!pool) {
    pool = await sql.connect(config);
    console.log('[MSSQL] Connected to LP database');
  }
  return pool;
}

async function query(queryString, params = {}) {
  const p = await getPool();
  const request = p.request();
  for (const [key, value] of Object.entries(params)) {
    request.input(key, value);
  }
  return request.query(queryString);
}

async function close() {
  if (pool) {
    await pool.close();
    pool = null;
  }
}

module.exports = { getPool, query, close, sql };
