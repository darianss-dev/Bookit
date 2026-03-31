# Bookit — Product Specification

## Overview

Build a personal book tracking web app called **Bookit**. The user reads books from Libby (library app), Audible (audiobooks), and tracks them manually. The goal is to automatically collect book data, enrich it with metadata, and maintain a shareable recommendations list.

---

## Tech Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Database**: SQLite (via better-sqlite3)
- **Google Sheets sync**: googleapis npm package (OAuth2)
- **Browser extension**: Chrome/Edge Manifest V3

---

## Data Model

Every book has these fields:

| Field | Type | Notes |
|-------|------|-------|
| id | integer | Auto-generated primary key |
| title | text | Required |
| author_name | text | |
| author_gender | text | Dropdown: Female, Male, Non-binary, Unknown |
| author_ethnicity | text | Dropdown: White, POC, Unknown |
| genre | text | Dropdown (see list below) |
| page_count | integer | For audiobooks, estimate from duration |
| series_name | text | e.g. "Wheel of Time" |
| series_order | decimal | e.g. 1, 2, 2.5 |
| date_read | text | YYYY-MM-DD |
| blurb | text | One sentence, max 300 characters |
| referral_source | text | Dropdown (see list below) |
| is_recommended | boolean | Star/flag for recommendations list |
| source | text | Manual, Libby, Audible, or Sheets |
| created_at | datetime | Auto |
| updated_at | datetime | Auto, via trigger |

### Referral source dropdown options
- Friend recommendation
- Family recommendation
- Book club
- Social media
- Goodreads
- Author's other work
- Library staff pick
- Podcast / review
- Award list
- Bookstore browse
- Other

### Genre dropdown options
- Fantasy, Science Fiction, Mystery / Thriller, Historical Fiction, Literary Fiction, Romance, Horror, Non-Fiction, Memoir / Biography, Self-Help, Young Adult, Middle Grade, Graphic Novel, Short Stories, Poetry, Other

---

## Backend

### API routes

**Books**
- `GET /api/books` — list all books. Query params: `search`, `genre`, `source`, `recommended=1`, `sort`, `order`
- `GET /api/books/genres` — distinct genre list for filter dropdown
- `GET /api/books/:id` — single book
- `POST /api/books` — create book
- `PUT /api/books/:id` — update book
- `PATCH /api/books/:id/recommend` — toggle is_recommended flag
- `DELETE /api/books/:id` — delete book
- `POST /api/books/import` — bulk import from browser extension (requires `X-Api-Key` header matching `EXTENSION_API_KEY` env var). Body: `{ books: [...], source: "Libby"|"Audible" }`. Deduplicates by title+author (case-insensitive). Returns `{ added, skipped }`.

**Sync**
- `GET /api/sync/status` — returns `{ connected: bool, last_sync: timestamp }`
- `POST /api/sync/push` — push all local books to Google Sheets
- `POST /api/sync/pull` — pull from Google Sheets into local DB
- `GET /auth/google/start` — redirect to Google OAuth consent screen
- `GET /auth/google/callback` — handle OAuth callback, save token

### Environment variables (`.env`)

```
PORT=3001
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback
GOOGLE_SPREADSHEET_ID=
GOOGLE_SHEET_NAME=Books
SYNC_INTERVAL_MINUTES=30
EXTENSION_API_KEY=
```

---

## Google Sheets Two-Way Sync

Columns A–N in the spreadsheet:

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
| I | Date Read |
| J | Blurb |
| K | Referral Source |
| L | Recommended (Yes / No) |
| M | Source |
| N | DB_ID (managed by app — links sheet rows to SQLite rows) |

- On first push, write a header row automatically if it doesn't exist
- **Push**: update existing rows (matched by DB_ID in col N), append new ones
- **Pull**: rows with a DB_ID update the matching SQLite record; rows without one are inserted if title+author doesn't already exist
- Store OAuth token in `backend/data/google_token.json`
- Auto-sync via cron if `SYNC_INTERVAL_MINUTES > 0`

---

## Frontend

### Pages / tabs

1. **Books tab** — default view
   - Filter bar: text search (title/author), genre dropdown, source dropdown, "Recommended only" toggle
   - Sortable table columns: Title, Author, Gender, Ethnicity, Genre, Pages, Series, Date Read, Source, Referral, Blurb, Actions
   - Star button (☆/★) on each row to toggle recommendation — starred rows get a subtle yellow highlight
   - Edit (✏️) and Delete (🗑️) action buttons per row

2. **Recommendations tab**
   - Shows only books where `is_recommended = true`
   - Card grid layout, grouped by genre
   - Each card shows: title, series info, author + gender + ethnicity, blurb (quoted), date read, referral source, page count
   - Star button to un-recommend directly from the card
   - Tab shows a count badge when there are recommendations

### Add / Edit modal
- Triggered by "+ Add Book" button or the edit icon
- Form fields for all data model fields
- Dropdowns for: author_gender, author_ethnicity, genre, referral_source, source
- Checkbox for is_recommended
- Character counter on blurb (max 300)
- Cancel and Save buttons

### Header sync bar
- Shows Google Sheets connection status (green dot if connected)
- "Last synced" timestamp
- "↓ Pull from Sheets" and "↑ Push to Sheets" buttons
- "Connect Google Sheets" link if not yet connected (opens `/auth/google/start`)
- Inline success/error feedback after sync

---

## Browser Extension (Manifest V3)

### Structure
```
extension/
  manifest.json
  background.js         ← service worker
  popup/
    popup.html
    popup.js
  content/
    libby.js            ← content script for libbyapp.com
    audible.js          ← content script for audible.com
  icons/
    icon16.png, icon48.png, icon128.png
```

### Permissions
- `storage`, `activeTab`, `scripting`
- Host permissions: `libbyapp.com`, `audible.com`, `localhost:3001`

### Background service worker
- Listens for `IMPORT_BOOKS` messages from content scripts
- POSTs to `{bookitUrl}/api/books/import` with `X-Api-Key` header
- Reads `bookitUrl` and `apiKey` from `chrome.storage.sync`

### Libby content script (`libby.js`)
- Runs on `libbyapp.com`
- Only activates on the reading history / previously-borrowed page
- Waits for Libby's SPA to render, scrolls to load all items, then scrapes:
  - Title, Author, Date borrowed
- Sends extracted books to background worker via `chrome.runtime.sendMessage`
- Shows an on-page toast notification with import result
- Re-runs on SPA navigation
- Also listens for a `BOOKIT_TRIGGER_LIBBY` custom window event (triggered by popup)

### Audible content script (`audible.js`)
- Runs on `audible.com`
- Does NOT auto-import — waits for a `TRIGGER_AUDIBLE_IMPORT` message from the popup
- Scrapes the library page for: Title, Author, Duration (convert to estimated page count at ~36 pages/hour), Purchase date
- Shows on-page toast with result

### Popup UI (`popup.html` / `popup.js`)
- Detects current tab URL to enable/disable import buttons
- **Libby section**: link to Libby history page + "Import from current Libby page" button
- **Audible section**: link to Audible library + "Import from current Audible page" button
- **Settings section**: Bookit URL input (default: `http://localhost:3001`), API Key input, Save button
- Shows per-section status messages (success / error)

---

## Setup & Running

```bash
# Backend
cd backend
cp .env.example .env   # fill in credentials
npm install
npm run dev            # http://localhost:3001

# Frontend
cd frontend
npm install
npm run dev            # http://localhost:5173
```

The frontend Vite config proxies `/api` and `/auth` to `http://localhost:3001`.

### Google Sheets setup (one-time)
1. Create OAuth 2.0 credentials at console.cloud.google.com (Web app type)
2. Add redirect URI: `http://localhost:3001/auth/google/callback`
3. Paste client_id and client_secret into `.env`
4. Visit `http://localhost:3001/auth/google/start` to authorize

### Extension install
1. Open `chrome://extensions`
2. Enable Developer mode
3. Click "Load unpacked" → select the `extension/` folder
4. Set Bookit URL and API key in the popup settings

---

## Non-functional requirements

- The app is for personal use — no user authentication needed
- SQLite database stored in `backend/data/bookit.db` (gitignored)
- Google OAuth token stored in `backend/data/google_token.json` (gitignored)
- `.env` is gitignored; `.env.example` is committed with placeholder values
- `node_modules/` and `frontend/dist/` are gitignored
- The extension import is idempotent — duplicate title+author combinations are skipped
- Audible doesn't have official API access for personal data, so scraping the library page DOM is the intended approach
- Libby similarly has no public API; scraping the history SPA page is the intended approach
