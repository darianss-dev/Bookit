# Bookit

A personal book tracking web app with:
- Full CRUD for books you've read
- Author metadata: gender, White vs POC
- Genre, page count, series order
- Date read, one-sentence blurb, referral source (dropdown)
- Star/recommendation flag with a dedicated Recommendations view
- Two-way sync with Google Sheets
- Browser extension to import from Libby and Audible

---

## Project structure

```
Bookit/
├── backend/        Node.js/Express API + SQLite + Google Sheets sync
├── frontend/       React (Vite) web app
└── extension/      Chrome/Edge Manifest V3 browser extension
```

---

## Quick start

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env (see Google Sheets setup below)
npm run dev        # runs on http://localhost:3001
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev        # runs on http://localhost:5173
```

Open **http://localhost:5173** in your browser.

---

## Google Sheets setup

Bookit can two-way sync with a Google Spreadsheet.

**Step 1 — Create OAuth credentials**

1. Go to https://console.cloud.google.com
2. Create a project (or use an existing one)
3. Enable the **Google Sheets API**
4. Go to **APIs & Services → Credentials**
5. Click **Create Credentials → OAuth 2.0 Client ID**
6. Application type: **Web application**
7. Add an Authorized redirect URI: `http://localhost:3001/auth/google/callback`
8. Download the JSON → copy the `client_id` and `client_secret` into your `.env`

**Step 2 — Add your Spreadsheet ID**

Copy the long ID from your spreadsheet URL:
```
https://docs.google.com/spreadsheets/d/THIS_IS_YOUR_ID/edit
```
Paste it as `GOOGLE_SPREADSHEET_ID` in `.env`.

**Step 3 — Authorize**

With the backend running, visit:
```
http://localhost:3001/auth/google/start
```
Sign in and allow access. You only need to do this once.

**Step 4 — Sync**

- In the app header, click **↓ Pull from Sheets** to import rows from your spreadsheet
- Click **↑ Push to Sheets** to write all app data back to the sheet
- Set `SYNC_INTERVAL_MINUTES` in `.env` for automatic background sync

### Spreadsheet column format

Bookit will create headers automatically. Columns are (A–N):

| Col | Field |
|-----|-------|
| A | Title |
| B | Author Name |
| C | Author Gender |
| D | Author Ethnicity |
| E | Genre |
| F | Page Count |
| G | Series Name |
| H | Series Order |
| I | Date Read (YYYY-MM-DD) |
| J | Blurb |
| K | Referral Source |
| L | Recommended (Yes/No) |
| M | Source |
| N | DB_ID (managed by app — do not edit) |

---

## Browser extension (Libby & Audible)

The extension imports books from Libby and Audible while you browse those sites.

### Install (Chrome / Edge / Brave)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder

### Configure

Click the Bookit extension icon → Settings:
- **Bookit URL**: `http://localhost:3001` (default)
- **API Key**: the value of `EXTENSION_API_KEY` in your backend `.env`

### Import from Libby

1. Go to https://libbyapp.com and navigate to your **Loans** or **Reading History**
2. The extension automatically scrapes visible books and imports them
3. Or click the extension popup → **Import from current Libby page**

### Import from Audible

1. Go to https://www.audible.com/library/titles
2. Click the extension popup → **Import from current Audible page**
3. For large libraries, Audible paginates — repeat on each page or select "All" items per page

### What gets imported

- **Title**, **Author**
- **Date read** (Libby borrow date / Audible purchase date)
- **Estimated page count** for Audible (converted from listening duration)
- **Source** tag (Libby or Audible)

You can fill in the remaining fields (genre, ethnicity, blurb, etc.) in the app afterward.

---

## Tracking fields

| Field | Notes |
|-------|-------|
| Title | Required |
| Author Name | |
| Author Gender | Female / Male / Non-binary / Unknown |
| Author Ethnicity | White / POC / Unknown |
| Genre | Preset list + free-form via Sheets |
| Page Count | |
| Series Name + Order | e.g. "Wheel of Time #1" |
| Date Read | YYYY-MM-DD |
| Blurb | One sentence, max 300 chars |
| Referral Source | Dropdown: Friend, Book club, Social media, etc. |
| Recommended | Star toggle — surfaces in Recommendations view |
| Source | Manual / Libby / Audible / Sheets |

---

## Deploying

For a permanent home, you can run this on any Linux VPS or a service like Railway/Render:

1. Set `NODE_ENV=production` and update `GOOGLE_REDIRECT_URI` to your public domain
2. Build the frontend: `cd frontend && npm run build` — serve `dist/` as static files from Express or nginx
3. Add `app.use(express.static('../frontend/dist'))` to `backend/src/index.js`
