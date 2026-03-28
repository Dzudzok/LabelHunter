require('dotenv').config();

// MSSQL — LP database on BOLOPC
// Tryb 1: Windows Authentication (domyslny — nie trzeba user/password)
// Tryb 2: SQL Server Authentication — odkomentuj user/password
// Windows Authentication — bez user/password
// Wymaga: npm install msnodesqlv8
const MSSQL_CONFIG = {
  connectionString: 'Driver={SQL Server};Server=localhost,64575;Database=label_printer;Trusted_Connection=yes;',
};

// Supabase — set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

// SMTP — for sending shipment emails from BOLOPC
// Set environment variables: SMTP_USER, SMTP_PASSWORD
// Or create a local .env file (not committed to git)
const SMTP_CONFIG = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASSWORD || '',
  },
  from: '"MROAUTO AUTODÍLY" <info@mroauto.cz>',
};

// App URL for tracking links
const APP_URL = process.env.APP_URL || 'https://labelhunter.mroautoapp.cz';

// Set to true to disable sending emails
const DISABLE_EMAIL = false;

// Test mode: all emails go to this address instead of the real customer
// Set to '' or remove to send to real customers
const EMAIL_OVERRIDE_TO = 'mateuszdurczok01@gmail.com';

module.exports = { MSSQL_CONFIG, SUPABASE_URL, SUPABASE_SERVICE_KEY, SMTP_CONFIG, APP_URL, DISABLE_EMAIL, EMAIL_OVERRIDE_TO };
