import { useState, useEffect } from 'react';
import { api } from '../api';

export default function SyncBar({ onSyncComplete }) {
  const [status, setStatus] = useState(null);
  const [syncing, setSyncing] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    api.sync.status().then(setStatus).catch(() => {});
  }, []);

  const doSync = async (direction) => {
    setSyncing(direction);
    setMessage(null);
    try {
      const fn = direction === 'push' ? api.sync.push : api.sync.pull;
      const result = await fn();
      const detail = direction === 'push'
        ? `Pushed. Updated ${result.updated}, added ${result.appended} rows.`
        : `Pulled. Added ${result.added}, updated ${result.updated}, skipped ${result.skipped}.`;
      setMessage({ type: 'success', text: detail });
      api.sync.status().then(setStatus).catch(() => {});
      if (onSyncComplete) onSyncComplete();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSyncing(null);
    }
  };

  if (!status) return null;

  return (
    <div className="sync-bar">
      <span className={`sync-indicator ${status.connected ? 'connected' : 'disconnected'}`}>
        {status.connected ? '● Google Sheets connected' : '○ Google Sheets not connected'}
      </span>

      {status.connected ? (
        <>
          {status.last_sync && (
            <span className="sync-last">Last sync: {new Date(status.last_sync).toLocaleString()}</span>
          )}
          <button className="btn-sync" onClick={() => doSync('pull')} disabled={!!syncing}>
            {syncing === 'pull' ? 'Pulling…' : '↓ Pull from Sheets'}
          </button>
          <button className="btn-sync" onClick={() => doSync('push')} disabled={!!syncing}>
            {syncing === 'push' ? 'Pushing…' : '↑ Push to Sheets'}
          </button>
        </>
      ) : (
        <a className="btn-sync" href="/auth/google/start" target="_blank" rel="noreferrer">
          Connect Google Sheets
        </a>
      )}

      {message && (
        <span className={`sync-msg sync-msg-${message.type}`}>{message.text}</span>
      )}
    </div>
  );
}
