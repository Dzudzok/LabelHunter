require('dotenv').config({ path: '../.env' });

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Middleware
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:4173', 'https://labelhunter-client.onrender.com'];
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, server-to-server, curl)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(null, false);
  },
  credentials: true,
}));
app.use(express.json());

// Serve label PDFs statically
const labelsDir = path.join(__dirname, 'labels');
if (!fs.existsSync(labelsDir)) {
  fs.mkdirSync(labelsDir, { recursive: true });
}
app.use('/labels', express.static(labelsDir));

// Routes
app.use('/api/workers', require('./routes/workers'));
app.use('/api/packages', require('./routes/packages'));
app.use('/api/nextis', require('./routes/nextis'));
app.use('/api/tracking', require('./routes/tracking'));
app.use('/api/email', require('./routes/email'));
app.use('/api/returns', require('./routes/returns'));
app.use('/api/labelprinter', require('./routes/labelprinter'));
app.use('/api/config', require('./routes/config'));
app.use('/api/hunters', require('./routes/hunters'));
app.use('/api/lp-import', require('./routes/lpImport'));
app.use('/api/qz', require('./routes/qz'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
  console.log(`LabelHunter server running on port ${PORT}`);

  // Start cron jobs
  // Nextis import disabled — import handled by lp-sync script on BOLOPC
  // require('./cron/importDeliveryNotes').start();
  require('./cron/syncTrackingStatus').start();

  console.log('Cron jobs started');
});

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});
