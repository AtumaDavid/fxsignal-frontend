import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { notificationsApi } from '../lib/api';
import { useDashboard } from '../lib/dashboard';
import { useJournal } from '../lib/journal';
import { relative, useNow } from '../lib/format';
import type { AppNotification } from '../lib/types';

const POLL_MS = 30_000;
/** How long an in-app alert stays on screen. */
const TOAST_MS = 9_000;

const TONE: Record<string, string> = {
  TARGET_HIT: 'dot-up',
  STOP_HIT: 'dot-down',
  TP1_HIT: 'dot-up',
  TP2_HIT: 'dot-up',
  TP3_HIT: 'dot-up',
  TRAIL_STOP_HIT: 'dot-up',
  CLOSED_EARLY: 'dot-flat',
  CANCELLED: 'dot-flat',
  ENTRY_FILLED: 'dot-live',
};

/** Top-bar bell: in-app copy of every alert, so nothing is missed. */
export function NotificationsBell() {
  const navigate = useNavigate();
  const now = useNow(60_000);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const { reload } = useDashboard();
  const { tradeFor } = useJournal();
  // In-app pop-ups for alerts that arrive while the app is open.
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const seen = useRef<Set<string> | null>(null);

  const dismiss = useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await notificationsApi.list();
      setItems(data.items);
      setUnread(data.unread);
      // First load: everything is old news. Later: pop up what is new.
      if (seen.current === null) {
        seen.current = new Set(data.items.map((n) => n.id));
        return;
      }
      const fresh = data.items.filter(
        (n) => !n.read && !seen.current!.has(n.id)
      );
      data.items.forEach((n) => seen.current!.add(n.id));
      if (fresh.length === 0) return;
      setToasts((list) =>
        [...fresh.slice(0, 3).reverse(), ...list].slice(0, 3)
      );
      fresh
        .slice(0, 3)
        .forEach((n) => setTimeout(() => dismiss(n.id), TOAST_MS));
      // The signal cards should show the same news straight away.
      void reload();
    } catch {
      // The bell is best-effort; the next poll retries.
    }
  }, [dismiss, reload]);

  useEffect(() => {
    void load();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      await notificationsApi.markRead().catch(() => undefined);
      setItems((list) => list.map((n) => ({ ...n, read: true })));
    }
  }

  // Alerts are connected to the journal: anything about a signal you hold
  // (TP1/trailing-stop management, fills, closes — and always your own
  // journal closes) lands on that journal trade with its drawer open, so a
  // breakeven takes one tap. Everything else opens the signals.
  const openFrom = (n: AppNotification) => {
    const held =
      n.predictionId !== null &&
      (() => {
        const t = tradeFor(n.predictionId);
        return t !== null && (n.kind === 'MY_TRADE_CLOSED' || t.exitPrice === null);
      })();
    navigate(
      held && n.predictionId
        ? `/app/journal?trade=${n.predictionId}`
        : '/app/signals'
    );
  };

  return (
    <div className="bell" ref={wrap}>
      {toasts.length > 0 && (
        <div className="toast-stack" role="status" aria-live="polite">
          {toasts.map((n) => (
            <div key={n.id} className="toast">
              <button
                type="button"
                className="toast-main"
                onClick={() => {
                  dismiss(n.id);
                  openFrom(n);
                }}
              >
                <span className={`dot ${TONE[n.kind] ?? ''}`} />
                <span className="bell-copy">
                  <strong>{n.title}</strong>
                  <span>{n.body}</span>
                </span>
              </button>
              <button
                type="button"
                className="icon-btn toast-close"
                aria-label="Dismiss"
                onClick={() => dismiss(n.id)}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        className="icon-btn"
        onClick={() => void toggle()}
        aria-label={unread > 0 ? `Alerts, ${unread} unread` : 'Alerts'}
        aria-expanded={open}
        data-tip="Alerts: new signals, entries, targets, stops, exits and your journal trades."
      >
        <Icon name="bell" size={17} />
        {unread > 0 && (
          <span className="bell-count">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>
      {open && (
        <div className="bell-panel" role="dialog" aria-label="Alerts">
          <div className="bell-head">
            <strong>Alerts</strong>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setOpen(false);
                  navigate('/app/notifications');
                }}
              >
                View all
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setOpen(false);
                  navigate('/app/settings#alerts');
                }}
              >
                Settings
              </button>
            </div>
          </div>
          {items.length === 0 ? (
            <p className="bell-empty">
              No alerts yet. You'll see new signals, entries, targets, stops and
              your journal trades here.
            </p>
          ) : (
            <>
              <ul className="bell-list">
                {items.slice(0, 20).map((n) => (
                  <li key={n.id}>
                    <button
                      className={`bell-item${n.read ? '' : ' unread'}`}
                      onClick={() => {
                        setOpen(false);
                        openFrom(n);
                      }}
                    >
                      <span className={`dot ${TONE[n.kind] ?? ''}`} />
                      <span className="bell-copy">
                        <strong>{n.title}</strong>
                        <span>{n.body}</span>
                        <em>{relative(n.createdAt, now)}</em>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="bell-head" style={{ borderTop: '1px solid var(--line)', borderBottom: 0 }}>
                <span className="faint" style={{ fontSize: 12 }}>
                  Auto-deleted after 30 days
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setOpen(false);
                    navigate('/app/notifications');
                  }}
                >
                  All notifications
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
