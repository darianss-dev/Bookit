/* global chrome */

const libbyBtn = document.getElementById('libby-btn');
const audibleBtn = document.getElementById('audible-btn');
const libbyStatus = document.getElementById('libby-status');
const audibleStatus = document.getElementById('audible-status');
const bookitUrlInput = document.getElementById('bookit-url');
const apiKeyInput = document.getElementById('api-key');
const saveBtn = document.getElementById('save-btn');
const settingsStatus = document.getElementById('settings-status');

function setStatus(el, msg, type = '') {
  el.textContent = msg;
  el.className = 'status' + (type ? ' ' + type : '');
}

// Load saved settings
chrome.storage.sync.get(['bookitUrl', 'apiKey'], (cfg) => {
  bookitUrlInput.value = cfg.bookitUrl || 'http://localhost:3001';
  apiKeyInput.value = cfg.apiKey || '';
});

// Save settings
saveBtn.addEventListener('click', () => {
  const url = bookitUrlInput.value.trim().replace(/\/$/, '');
  const key = apiKeyInput.value.trim();
  chrome.storage.sync.set({ bookitUrl: url, apiKey: key }, () => {
    setStatus(settingsStatus, 'Saved!', 'success');
    setTimeout(() => setStatus(settingsStatus, ''), 2000);
  });
});

// Detect active tab
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (!tab) return;
  const url = tab.url || '';

  const isLibby = url.includes('libbyapp.com');
  const isAudible = url.includes('audible.com');

  libbyBtn.disabled = !isLibby;
  audibleBtn.disabled = !isAudible;

  if (!isLibby) setStatus(libbyStatus, 'Open libbyapp.com to enable');
  if (!isAudible) setStatus(audibleStatus, 'Open audible.com to enable');
});

// Libby import — Libby's content script auto-imports on the history page.
// The button triggers a re-run via a message.
libbyBtn.addEventListener('click', () => {
  libbyBtn.disabled = true;
  setStatus(libbyStatus, 'Scraping Libby…');

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        func: () => {
          // Re-dispatch a custom event that the content script listens to
          window.dispatchEvent(new CustomEvent('BOOKIT_TRIGGER_LIBBY'));
        },
      },
      () => {
        // The content script will show its own toast; just indicate we triggered it
        setStatus(libbyStatus, 'Import triggered — check the page for a confirmation toast.', 'success');
        libbyBtn.disabled = false;
      }
    );
  });
});

// Audible import — triggered via message to content script
audibleBtn.addEventListener('click', () => {
  audibleBtn.disabled = true;
  setStatus(audibleStatus, 'Importing from Audible…');

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_AUDIBLE_IMPORT' }, (response) => {
      if (chrome.runtime.lastError) {
        setStatus(audibleStatus, 'Error: ' + chrome.runtime.lastError.message, 'error');
      } else if (response?.success) {
        setStatus(audibleStatus, `Done! ${response.count} books processed.`, 'success');
      } else {
        setStatus(audibleStatus, 'Failed: ' + (response?.error || 'unknown error'), 'error');
      }
      audibleBtn.disabled = false;
    });
  });
});
