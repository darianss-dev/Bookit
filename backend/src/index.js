require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const booksRouter = require('./routes/books');
const syncRouter = require('./routes/sync');
const { syncToSheets, syncFromSheets, isConnected } = require('./services/googleSheets');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Routes
app.use('/api/books', booksRouter);
app.use('/api/sync', syncRouter);
// Auth routes live under /auth (not /api) so OAuth redirect URI is clean
app.use('/auth', syncRouter);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Auto-sync cron job
const syncInterval = Number(process.env.SYNC_INTERVAL_MINUTES || 0);
if (syncInterval > 0) {
  cron.schedule(`*/${syncInterval} * * * *`, async () => {
    if (!isConnected()) return;
    try {
      console.log('[cron] Running Google Sheets sync...');
      await syncFromSheets();
      await syncToSheets();
      console.log('[cron] Sync complete.');
    } catch (err) {
      console.error('[cron] Sync error:', err.message);
    }
  });
  console.log(`Auto-sync scheduled every ${syncInterval} minute(s).`);
}

app.listen(PORT, () => {
  console.log(`Bookit backend running on http://localhost:${PORT}`);
  if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID === 'your_client_id_here') {
    console.log('  Google Sheets not configured. Copy .env.example to .env and fill in credentials.');
  }
});
