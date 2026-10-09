import { useCallback, useEffect, useState } from 'react';
import { Icon } from './Icon';
import { Spinner } from './ui/Empty';
import { API_BASE, mt5Api } from '../lib/api';
import { relative, useNow } from '../lib/format';
import { useJournal } from '../lib/journal';
import type { Mt5Status } from '../lib/types';

const SYNC_URL = `${API_BASE}/mt5/sync`;
const ALLOW_URL = new URL(API_BASE).origin;

/** Settings → MT5 sync: read-only journal sync from MetaTrader 5 (Exness included). */
export function Mt5Sync() {
  const now = useNow(30_000);
  const { reload } = useJournal();
  const [status, setStatus] = useState<Mt5Status | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStatus(await mt5Api.status());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unavailable.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  // While waiting for the first sync, check every 20 s.
  useEffect(() => {
    if (!status?.linked || status.link?.lastSyncAt) return;
    const id = setInterval(() => {
      void load();
      void reload();
    }, 20_000);
    return () => clearInterval(id);
  }, [status, load, reload]);

  async function createKey() {
    setBusy(true);
    setError(null);
    try {
      const { key: fresh } = await mt5Api.createKey();
      setKey(fresh);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create a key.');
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    setBusy(true);
    try {
      await mt5Api.unlink();
      setKey(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Select-and-copy still works.
    }
  }

  if (!status) return <div className="skeleton" style={{ height: 140 }} />;
  const link = status.link;

  return (
    <div className="settings-form" style={{ maxWidth: 560 }}>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="pref-list">
        <div className="pref-row">
          <div>
            <strong>
              {status.linked
                ? link?.lastSyncAt
                  ? 'Connected'
                  : 'Waiting for the first sync'
                : 'Not connected'}
            </strong>
            <span>
              {status.linked && link
                ? link.lastSyncAt
                  ? `Last sync ${relative(link.lastSyncAt, now)}${link.lastAccount ? ` · account ${link.lastAccount}` : ''}${link.lastBroker ? ` · ${link.lastBroker}` : ''} · ${link.lastMatched ?? 0} of ${link.lastPositions ?? 0} positions matched to signals`
                  : `Key …${link.tokenHint} is ready. Attach the EA in MT5 (steps below).`
                : 'Your journal fills itself from your real MT5 trades: entry, exit and lot size, matched to the signal you followed. Read-only — FXSignal can never place or change a trade.'}
            </span>
          </div>
          {status.linked ? (
            <span
              className={`tag ${link?.lastSyncAt ? 'tag-up' : 'tag-solid'}`}
            >
              {link?.lastSyncAt ? 'On' : 'Pending'}
            </span>
          ) : null}
        </div>
      </div>

      {key && (
        <div className="mt5-key">
          <span>
            Your sync key — shown once. Paste it into the EA's inputs.
          </span>
          <div>
            <code>{key}</code>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void copy()}
            >
              <Icon name={copied ? 'check' : 'plus'} size={13} />
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {(status.linked || key) && (
        <ol className="mt5-steps">
          <li>
            <a
              href="/downloads/FXSignal-Sync.mq5"
              download
              className="btn btn-secondary btn-sm"
            >
              Download the EA
            </a>{' '}
            (FXSignal-Sync.mq5).
          </li>
          <li>
            In MT5: <b>Tools → Options → Expert Advisors</b>, tick{' '}
            <b>Allow WebRequest for listed URL</b> and add{' '}
            <code>{ALLOW_URL}</code>.
          </li>
          <li>
            <b>File → Open Data Folder → MQL5 → Experts</b>: put the file there,
            then right-click <b>Expert Advisors</b> in the Navigator →{' '}
            <b>Refresh</b>.
          </li>
          <li>
            Drag <b>FXSignal-Sync</b> onto any chart, paste your key into{' '}
            <b>SyncKey</b>, turn on <b>Algo Trading</b>, and press OK. The chart
            shows "FXSignal Sync: OK" when it works.
          </li>
          <li className="faint">
            Keep MT5 running (on your computer or a VPS). Works with any broker,
            including Exness symbols like EURUSDm. Positions on EUR/USD and
            USD/JPY are matched to the signal of the same direction opened
            during its window; several positions on one signal (one per TP)
            become one journal trade.
          </li>
        </ol>
      )}

      <div className="actions">
        <button
          className={`btn ${status.linked ? 'btn-ghost' : 'btn-primary'}`}
          onClick={() => void createKey()}
          disabled={busy}
        >
          {busy && <Spinner />}
          {status.linked ? 'Create a new key' : 'Connect MT5'}
        </button>
        {status.linked && (
          <button
            className="btn btn-ghost"
            onClick={() => void unlink()}
            disabled={busy}
          >
            Disconnect
          </button>
        )}
      </div>
      <p className="faint" style={{ fontSize: 12 }}>
        Sync address: <code>{SYNC_URL}</code>. A new key stops the old one.
      </p>
    </div>
  );
}
