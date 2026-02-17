/**
 * Libby content script.
 * Runs on libbyapp.com — scrapes reading history from the Timeline page.
 *
 * Libby's Timeline (libbyapp.com/tags/previously-borrowed) lists all borrowed titles.
 * Each item renders: title, author, format (book/audiobook), borrow date.
 *
 * The script waits for the page to fully render (Libby is a SPA),
 * then extracts book data and sends it to the background worker.
 */

(function () {
  let injected = false;

  function waitForContent(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(selector)) return resolve(document.querySelector(selector));
      const observer = new MutationObserver(() => {
        if (document.querySelector(selector)) {
          observer.disconnect();
          resolve(document.querySelector(selector));
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); reject(new Error('Timed out')); }, timeout);
    });
  }

  function parseDate(str) {
    if (!str) return null;
    // Libby shows dates like "Jan 5, 2024" or "January 5, 2024"
    const d = new Date(str);
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
    return null;
  }

  function extractBooks() {
    const books = [];

    // Libby renders shelved/history items with aria roles or specific class names.
    // Selector targets history card items — adjust if Libby's DOM changes.
    const cards = document.querySelectorAll(
      '[data-testid="shelf-item"], .TileBook, .od-tile, li[class*="shelf"]'
    );

    cards.forEach((card) => {
      const titleEl = card.querySelector(
        '[data-testid="book-title"], .TileBook__title, [class*="title"], h3, h4'
      );
      const authorEl = card.querySelector(
        '[data-testid="book-author"], .TileBook__author, [class*="author"], [class*="creator"]'
      );
      const dateEl = card.querySelector(
        '[data-testid="borrow-date"], [class*="date"], time'
      );

      const title = titleEl?.textContent?.trim();
      if (!title) return;

      const author = authorEl?.textContent?.trim()
        ?.replace(/^by\s+/i, '')
        ?.replace(/\s*;\s*.+$/, '') // strip multiple authors after semicolon
        ?.trim();

      const dateStr = dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim();

      books.push({
        title,
        author_name: author || null,
        date_read: parseDate(dateStr),
        source: 'Libby',
      });
    });

    return books;
  }

  async function run() {
    if (injected) return;

    // Only activate on the history/timeline page
    const isHistoryPage = window.location.href.includes('previously-borrowed')
      || window.location.href.includes('timeline')
      || window.location.href.includes('history');

    if (!isHistoryPage) return;
    injected = true;

    try {
      // Wait for Libby's SPA to render items
      await waitForContent('[data-testid="shelf-item"], .TileBook, .od-tile', 8000)
        .catch(() => {}); // proceed even if selector not found

      // Additional delay for Libby's lazy-loading
      await new Promise((r) => setTimeout(r, 1500));

      // Scroll to trigger lazy-loading of all items
      let lastHeight = 0;
      for (let i = 0; i < 10; i++) {
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise((r) => setTimeout(r, 800));
        if (document.body.scrollHeight === lastHeight) break;
        lastHeight = document.body.scrollHeight;
      }
      window.scrollTo(0, 0);

      const books = extractBooks();

      if (books.length === 0) {
        console.log('[Bookit] No Libby books found. Make sure you are on the reading history page.');
        return;
      }

      console.log(`[Bookit] Found ${books.length} Libby books. Sending to Bookit…`);

      chrome.runtime.sendMessage(
        { type: 'IMPORT_BOOKS', books, source: 'Libby' },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('[Bookit] Extension error:', chrome.runtime.lastError.message);
            return;
          }
          if (response?.success) {
            console.log(`[Bookit] Imported: ${response.added} added, ${response.skipped} skipped.`);
            showToast(`Bookit: ${response.added} books imported, ${response.skipped} already exist.`);
          } else {
            console.error('[Bookit] Import failed:', response?.error);
            showToast('Bookit: Import failed. Is the backend running? Check the extension settings.');
          }
        }
      );
    } catch (err) {
      console.error('[Bookit] Libby scrape error:', err);
    }
  }

  function showToast(msg) {
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'fixed', bottom: '24px', right: '24px', zIndex: '99999',
      background: '#4361ee', color: '#fff', padding: '12px 20px',
      borderRadius: '8px', fontSize: '14px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
      maxWidth: '340px', lineHeight: '1.4',
    });
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 6000);
  }

  // Run when page is ready (Libby is a SPA — watch for navigation too)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

  // Allow the popup to trigger a re-import manually
  window.addEventListener('BOOKIT_TRIGGER_LIBBY', () => {
    injected = false;
    run();
  });

  // Re-run on SPA navigation
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      injected = false;
      setTimeout(run, 1000);
    }
  }).observe(document, { subtree: true, childList: true });
})();
