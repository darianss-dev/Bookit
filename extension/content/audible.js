/**
 * Audible content script.
 * Runs on audible.com — scrapes the user's library page.
 *
 * Audible library URL: https://www.audible.com/library/titles
 * Each row contains: title, author(s), narrator, duration, date added/purchased.
 *
 * Note: Audible paginates results (20 per page). The script imports the current page.
 * The popup lets the user trigger import page-by-page or navigate to "All items" view.
 */

(function () {
  function parseAudibleDuration(str) {
    // e.g. "8 hrs and 12 mins" or "12 hrs"
    if (!str) return null;
    const hours = str.match(/(\d+)\s*hr/i);
    const mins = str.match(/(\d+)\s*min/i);
    const totalMins = (hours ? Number(hours[1]) * 60 : 0) + (mins ? Number(mins[1]) : 0);
    // Rough conversion: audiobooks average ~9,000 words/hour, ~250 words/page → ~36 pages/hour
    return totalMins ? Math.round((totalMins / 60) * 36) : null;
  }

  function parseDate(str) {
    if (!str) return null;
    const d = new Date(str);
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
    // Try "MM-DD-YY" or similar
    const parts = str.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
    if (parts) {
      const d2 = new Date(`${parts[1]}/${parts[2]}/${parts[3]}`);
      if (!isNaN(d2)) return d2.toISOString().slice(0, 10);
    }
    return null;
  }

  function extractBooks() {
    const books = [];

    // Audible library renders as a list of .adbl-library-content-row or similar
    const rows = document.querySelectorAll(
      '.adbl-library-content-row, [data-testid="library-title-row"], li.bc-list-item'
    );

    rows.forEach((row) => {
      // Title
      const titleEl = row.querySelector(
        '[data-testid="title"], .bc-heading a, h3 a, .adbl-title a, a[class*="title"]'
      );
      const title = titleEl?.textContent?.trim();
      if (!title) return;

      // Author
      const authorEl = row.querySelector(
        '[data-testid="author"], .authorLabel a, a[class*="author"], span[class*="author"] a'
      );
      const authorRaw = authorEl?.textContent?.trim() || '';
      // Audible sometimes shows "Written by: First Last" — strip prefix
      const author = authorRaw.replace(/^written\s+by[:\s]*/i, '').trim() || null;

      // Duration → estimated page count
      const durationEl = row.querySelector(
        '[data-testid="runtime"], .runtimeLabel, span[class*="runtime"], span[class*="length"]'
      );
      const page_count = parseAudibleDuration(durationEl?.textContent?.trim());

      // Date purchased/added
      const dateEl = row.querySelector(
        '[data-testid="purchase-date"], .purchase-date, span[class*="date"]'
      );
      const dateStr = dateEl?.textContent?.trim();

      books.push({
        title,
        author_name: author,
        page_count,
        date_read: parseDate(dateStr),
        source: 'Audible',
      });
    });

    return books;
  }

  function showToast(msg, color = '#4361ee') {
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'fixed', bottom: '24px', right: '24px', zIndex: '99999',
      background: color, color: '#fff', padding: '12px 20px',
      borderRadius: '8px', fontSize: '14px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
      maxWidth: '340px', lineHeight: '1.4',
    });
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 6000);
  }

  // Listen for a trigger message from the popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TRIGGER_AUDIBLE_IMPORT') {
      const books = extractBooks();

      if (books.length === 0) {
        showToast('Bookit: No Audible books found on this page. Navigate to your Library first.', '#e63946');
        sendResponse({ success: false, error: 'No books found' });
        return;
      }

      chrome.runtime.sendMessage(
        { type: 'IMPORT_BOOKS', books, source: 'Audible' },
        (response) => {
          if (response?.success) {
            showToast(`Bookit: ${response.added} Audible books imported, ${response.skipped} already exist.`);
            sendResponse({ success: true, count: books.length });
          } else {
            showToast(`Bookit: Import failed — ${response?.error || 'unknown error'}`, '#e63946');
            sendResponse({ success: false, error: response?.error });
          }
        }
      );

      return true; // async
    }

    if (message.type === 'GET_AUDIBLE_COUNT') {
      const books = extractBooks();
      sendResponse({ count: books.length });
    }
  });

  // Auto-import when on the library page (passive — waits for popup trigger instead)
  console.log('[Bookit] Audible content script loaded. Open the Bookit extension popup to import.');
})();
