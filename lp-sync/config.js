// MSSQL — LP database on BOLOPC
// Tryb 1: Windows Authentication (domyslny — nie trzeba user/password)
// Tryb 2: SQL Server Authentication — odkomentuj user/password
// Windows Authentication — bez user/password
// Wymaga: npm install msnodesqlv8
const MSSQL_CONFIG = {
  connectionString: 'Driver={SQL Server};Server=localhost,64575;Database=label_printer;Trusted_Connection=yes;',
};

// Supabase
const SUPABASE_URL = 'https://wbbqqjsgkgpeatdstyui.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndiYnFxanNna2dwZWF0ZHN0eXVpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjM1OTIzMSwiZXhwIjoyMDg3OTM1MjMxfQ.AFfq-9nTxA_xinMs588n1E72tahy7Bj02TP2UTnkXZk';

module.exports = { MSSQL_CONFIG, SUPABASE_URL, SUPABASE_SERVICE_KEY };
