/**
 * Background service worker.
 * Receives books from content scripts and posts them to the Bookit backend.
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'IMPORT_BOOKS') {
    handleImport(message.books, message.source)
      .then((result) => sendResponse({ success: true, ...result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for async response
  }
});

async function handleImport(books, source) {
  const config = await chrome.storage.sync.get(['bookitUrl', 'apiKey']);
  const baseUrl = config.bookitUrl || 'http://localhost:3001';
  const apiKey = config.apiKey || '';

  const res = await fetch(`${baseUrl}/api/books/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({ books, source }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Server error ${res.status}: ${text}`);
  }

  return res.json();
}
