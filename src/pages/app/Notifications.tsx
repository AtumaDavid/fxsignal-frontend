import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { Empty, Spinner } from '../../components/ui/Empty';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { notificationsApi } from '../../lib/api';
import { useJournal } from '../../lib/journal';
import { relative, useNow } from '../../lib/format';
import type { AppNotification } from '../../lib/types';

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

type PendingClear = 'read' | 'all' | null;

/**
 * Full notification history. Retention is automatic (30 days, max 200 per
 * user, pruned by the API on every list + nightly maintenance); the delete
 * buttons here are the manual side of the same policy.
 */
export default function Notifications() {
  const navigate = useNavigate();
  const now = useNow(60_000);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [pendingClear, setPendingClear] = useState<PendingClear>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await notificationsApi.list(signal);
      setItems(data.items);
      setError(null);
    } catch (err) {
      if (signal?.aborted) return;
      setError(
        err instanceof Error ? err.message : 'Notifications are unavailable.'
      );
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function remove(id: string) {
    setBusyId(id);
    try {
      await notificationsApi.remove(id);
      setItems((list) => list?.filter((n) => n.id !== id) ?? null);
    } catch {
      // Row stays; the next load retries.
    } finally {
      setBusyId(null);
    }
  }

  async function clear(mode: 'read' | 'all') {
    setClearing(true);
    try {
      await notificationsApi.clear(mode);
      if (mode === 'all') setItems([]);
      else {
        // Only read rows were deleted; keep the unread ones.
        setItems((list) => list?.filter((n) => !n.read) ?? null);
      }
      setPendingClear(null);
    } finally {
      setClearing(false);
    }
  }

  async function markAllRead() {
    await notificationsApi.markRead().catch(() => undefined);
    setItems((list) => list?.map((n) => ({ ...n, read: true })) ?? null);
  }

  const { tradeFor } = useJournal();

  // Same journal connection as the bell: alerts about a signal you hold open
  // land on that journal trade (drawer open), so a breakeven is one tap.
  const openFrom = (n: AppNotification) => {
    void notificationsApi.markRead([n.id]).catch(() => undefined);
    const t = n.predictionId ? tradeFor(n.predictionId) : null;
    const held =
      t !== null && (n.kind === 'MY_TRADE_CLOSED' || t.exitPrice === null);
    navigate(
      held && n.predictionId
        ? `/app/journal?trade=${n.predictionId}`
        : '/app/signals'
    );
  };

  const unread = items?.filter((n) => !n.read).length ?? 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Notifications</h1>
          <p>
            Every signal, entry, target, stop and journal-trade alert. Old
            notifications are deleted automatically after 30 days (max 200
            kept) — or delete them yourself here.
          </p>
        </div>
        <div className="page-actions">
          {unread > 0 && (
            <button
              className="btn btn-secondary"
              onClick={() => void markAllRead()}
            >
              <Icon name="check" size={14} /> Mark all read
            </button>
          )}
          <button
            className="btn btn-ghost"
            onClick={() => setPendingClear('read')}
            disabled={!items || items.every((n) => !n.read)}
          >
            Clear read
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => setPendingClear('all')}
            disabled={!items || items.length === 0}
          >
            Clear all
          </button>
        </div>
      </div>

      {error && !items ? (
        <div className="panel">
          <Empty icon="bell" title="Notifications unavailable">
            {error}
          </Empty>
        </div>
      ) : !items ? (
        <div className="panel panel-body stack">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 52 }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="panel">
          <Empty icon="bell" title="No notifications">
            New signals, entries, targets, stops and your journal trades will
            appear here — and in the bell at the top.
          </Empty>
        </div>
      ) : (
        <section className="panel">
          <div className="notif-list">
            {items.map((n) => (
              <div
                key={n.id}
                className={`notif-row${n.read ? '' : ' unread'}`}
              >
                <span className={`dot ${TONE[n.kind] ?? ''}`} />
                <button
                  type="button"
                  className="notif-copy"
                  style={{ textAlign: 'left' }}
                  onClick={() => openFrom(n)}
                >
                  <strong>{n.title}</strong>
                  <span>{n.body}</span>
                  <em>{relative(n.createdAt, now)}</em>
                </button>
                <button
                  type="button"
                  className="icon-btn notif-delete"
                  aria-label={`Delete notification: ${n.title}`}
                  disabled={busyId === n.id}
                  onClick={() => void remove(n.id)}
                >
                  {busyId === n.id ? <Spinner /> : <Icon name="close" size={15} />}
                </button>
              </div>
            ))}
          </div>
          <div className="footnote">
            <Icon name="info" size={13} />
            Select a notification to open it: alerts about a signal you hold
            open your journal trade (so a breakeven is one tap), everything
            else opens the signals. Read notifications can be cleared in bulk;
            unread ones are kept until you read or delete them.
          </div>
        </section>
      )}

      {pendingClear && (
        <ConfirmModal
          title={pendingClear === 'all' ? 'Clear all notifications?' : 'Clear read notifications?'}
          message={
            pendingClear === 'all'
              ? 'Every notification will be permanently deleted, including unread ones. This cannot be undone.'
              : 'Read notifications will be permanently deleted. Unread ones are kept.'
          }
          confirmLabel={pendingClear === 'all' ? 'Clear all' : 'Clear read'}
          danger
          busy={clearing}
          onCancel={() => setPendingClear(null)}
          onConfirm={() => void clear(pendingClear)}
        />
      )}
    </>
  );
}
