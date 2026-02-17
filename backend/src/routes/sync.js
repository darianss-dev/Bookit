const express = require('express');
const router = express.Router();
const sheets = require('../services/googleSheets');

// GET /api/sync/status
router.get('/status', (req, res) => {
  res.json({
    connected: sheets.isConnected(),
    last_sync: sheets.getLastSync(),
  });
});

// GET /auth/google/start — redirect user to Google OAuth consent screen
router.get('/auth/google/start', (req, res) => {
  const url = sheets.getAuthUrl();
  res.redirect(url);
});

// GET /auth/google/callback
router.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing code parameter.');
  try {
    await sheets.handleAuthCallback(code);
    res.send('<h2>Google Sheets connected!</h2><p>You can close this tab and return to Bookit.</p>');
  } catch (err) {
    console.error('OAuth callback error:', err.message);
    res.status(500).send('Authentication failed: ' + err.message);
  }
});

// POST /api/sync/push — push all local books to Sheets
router.post('/push', async (req, res) => {
  try {
    const result = await sheets.syncToSheets();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sync/pull — pull from Sheets into local DB
router.post('/pull', async (req, res) => {
  try {
    const result = await sheets.syncFromSheets();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
