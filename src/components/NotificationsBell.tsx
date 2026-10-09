import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { notificationsApi } from '../lib/api';
import { relative, useNow } from '../lib/format';
import type { AppNotification } from '../lib/types';

const POLL_MS = 60_000;

const TONE: Record<string, string> = {
  TARGET_HIT: 'dot-up',
  STOP_HIT: 'dot-down',
  BREAKEVEN_HIT: 'dot-flat',
  BREAKEVEN_SET: 'dot-live',
  TP1_HIT: 'dot-up',
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

  const load = useCallback(async () => {
    try {
      const data = await notificationsApi.list();
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      // The bell is best-effort; the next poll retries.
    }
  }, []);

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

  return (
    <div className="bell" ref={wrap}>
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
          {items.length === 0 ? (
            <p className="bell-empty">
              No alerts yet. You'll see new signals, entries, targets, stops and
              your journal trades here.
            </p>
          ) : (
            <ul className="bell-list">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    className={`bell-item${n.read ? '' : ' unread'}`}
                    onClick={() => {
                      setOpen(false);
                      navigate(
                        n.kind === 'MY_TRADE_CLOSED'
                          ? '/app/journal'
                          : '/app/signals'
                      );
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
          )}
        </div>
      )}
    </div>
  );
}
