/**
 * Google Sheets two-way sync service.
 *
 * Column mapping (1-indexed, configurable via SHEET_COLUMNS env):
 *  A  Title
 *  B  Author Name
 *  C  Author Gender
 *  D  Author Ethnicity
 *  E  Genre
 *  F  Page Count
 *  G  Series Name
 *  H  Series Order
 *  I  Date Read (YYYY-MM-DD)
 *  J  Blurb
 *  K  Referral Source
 *  L  Recommended (Yes/No)
 *  M  Source (Libby/Audible/Manual)
 *  N  DB ID (used to match rows back to SQLite rows)
 */

const { google } = require('googleapis');
const db = require('../database');
const path = require('path');
const fs = require('fs');

const TOKEN_PATH = path.join(__dirname, '..', '..', 'data', 'google_token.json');

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function getAuthenticatedClient() {
  const client = getOAuthClient();
  if (!fs.existsSync(TOKEN_PATH)) return null;
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  client.setCredentials(token);
  return client;
}

function saveToken(token) {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
}

const SHEET_NAME = () => process.env.GOOGLE_SHEET_NAME || 'Books';
const SPREADSHEET_ID = () => process.env.GOOGLE_SPREADSHEET_ID;

const COLUMNS = ['title', 'author_name', 'author_gender', 'author_ethnicity',
  'genre', 'page_count', 'series_name', 'series_order', 'date_read',
  'blurb', 'referral_source', 'is_recommended', 'source', 'id'];

function rowToBook(row) {
  return {
    title: row[0] || null,
    author_name: row[1] || null,
    author_gender: row[2] || null,
    author_ethnicity: row[3] || null,
    genre: row[4] || null,
    page_count: row[5] ? Number(row[5]) : null,
    series_name: row[6] || null,
    series_order: row[7] ? Number(row[7]) : null,
    date_read: row[8] || null,
    blurb: row[9] || null,
    referral_source: row[10] || null,
    is_recommended: row[11] === 'Yes' ? 1 : 0,
    source: row[12] || 'Sheets',
    id: row[13] ? Number(row[13]) : null,
  };
}

function bookToRow(book) {
  return [
    book.title || '',
    book.author_name || '',
    book.author_gender || '',
    book.author_ethnicity || '',
    book.genre || '',
    book.page_count != null ? String(book.page_count) : '',
    book.series_name || '',
    book.series_order != null ? String(book.series_order) : '',
    book.date_read || '',
    book.blurb || '',
    book.referral_source || '',
    book.is_recommended ? 'Yes' : 'No',
    book.source || 'Manual',
    String(book.id),
  ];
}

async function ensureHeaderRow(sheets) {
  const headers = ['Title', 'Author Name', 'Author Gender', 'Author Ethnicity',
    'Genre', 'Page Count', 'Series Name', 'Series Order', 'Date Read',
    'Blurb', 'Referral Source', 'Recommended', 'Source', 'DB_ID'];

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID(),
    range: `${SHEET_NAME()}!A1:N1`,
  });

  if (!res.data.values || res.data.values[0]?.[0] !== 'Title') {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID(),
      range: `${SHEET_NAME()}!A1:N1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    });
  }
}

async function syncToSheets() {
  const auth = getAuthenticatedClient();
  if (!auth) throw new Error('Not authenticated with Google. Visit /auth/google/start to connect.');

  const sheets = google.sheets({ version: 'v4', auth });
  await ensureHeaderRow(sheets);

  // Read current sheet rows (skip header)
  const readRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID(),
    range: `${SHEET_NAME()}!A2:N`,
  });
  const sheetRows = readRes.data.values || [];

  // Build index of sheet rows by DB_ID
  const sheetById = {};
  sheetRows.forEach((row, i) => {
    const dbId = row[13] ? Number(row[13]) : null;
    if (dbId) sheetById[dbId] = { row, rowIndex: i + 2 }; // 1-based, +1 for header
  });

  const allBooks = db.prepare('SELECT * FROM books').all();

  // Update existing rows; collect new books to append
  const toAppend = [];
  const updateRequests = [];

  for (const book of allBooks) {
    const sheetEntry = sheetById[book.id];
    if (sheetEntry) {
      // Update in place
      updateRequests.push({
        range: `${SHEET_NAME()}!A${sheetEntry.rowIndex}:N${sheetEntry.rowIndex}`,
        values: [bookToRow(book)],
      });
    } else {
      toAppend.push(bookToRow(book));
    }
  }

  // Batch update existing rows
  if (updateRequests.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID(),
      requestBody: {
        valueInputOption: 'RAW',
        data: updateRequests,
      },
    });
  }

  // Append new books
  if (toAppend.length) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID(),
      range: `${SHEET_NAME()}!A:N`,
      valueInputOption: 'RAW',
      requestBody: { values: toAppend },
    });
  }

  db.prepare("INSERT OR REPLACE INTO sync_state (key, value) VALUES ('last_sync', ?)")
    .run(new Date().toISOString());

  return { updated: updateRequests.length, appended: toAppend.length };
}

async function syncFromSheets() {
  const auth = getAuthenticatedClient();
  if (!auth) throw new Error('Not authenticated with Google.');

  const sheets = google.sheets({ version: 'v4', auth });

  const readRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID(),
    range: `${SHEET_NAME()}!A2:N`,
  });
  const sheetRows = readRes.data.values || [];

  let added = 0, updated = 0, skipped = 0;

  const upsertMany = db.transaction((rows) => {
    for (const row of rows) {
      if (!row[0]) { skipped++; continue; } // skip blank title rows

      const book = rowToBook(row);

      if (book.id) {
        // Row has a DB_ID — update existing record
        const existing = db.prepare('SELECT id FROM books WHERE id = ?').get(book.id);
        if (existing) {
          db.prepare(`
            UPDATE books SET
              title=?, author_name=?, author_gender=?, author_ethnicity=?,
              genre=?, page_count=?, series_name=?, series_order=?,
              date_read=?, blurb=?, referral_source=?, is_recommended=?, source=?
            WHERE id=?
          `).run(
            book.title, book.author_name, book.author_gender, book.author_ethnicity,
            book.genre, book.page_count, book.series_name, book.series_order,
            book.date_read, book.blurb, book.referral_source, book.is_recommended, book.source,
            book.id
          );
          updated++;
          continue;
        }
      }

      // No DB_ID or not found — check by title+author
      const existing = db.prepare(
        'SELECT id FROM books WHERE lower(title) = lower(?) AND lower(coalesce(author_name,\'\')) = lower(?)'
      ).get(book.title, book.author_name || '');

      if (existing) { skipped++; continue; }

      db.prepare(`
        INSERT INTO books
          (title, author_name, author_gender, author_ethnicity, genre, page_count,
           series_name, series_order, date_read, blurb, referral_source, is_recommended, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        book.title, book.author_name, book.author_gender, book.author_ethnicity,
        book.genre, book.page_count, book.series_name, book.series_order,
        book.date_read, book.blurb, book.referral_source, book.is_recommended, book.source
      );
      added++;
    }
  });

  upsertMany(sheetRows);
  return { added, updated, skipped };
}

function getAuthUrl() {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/spreadsheets'],
    prompt: 'consent',
  });
}

async function handleAuthCallback(code) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  saveToken(tokens);
  return tokens;
}

function getLastSync() {
  const row = db.prepare("SELECT value FROM sync_state WHERE key = 'last_sync'").get();
  return row ? row.value : null;
}

function isConnected() {
  return fs.existsSync(TOKEN_PATH);
}

module.exports = {
  syncToSheets,
  syncFromSheets,
  getAuthUrl,
  handleAuthCallback,
  getLastSync,
  isConnected,
};
