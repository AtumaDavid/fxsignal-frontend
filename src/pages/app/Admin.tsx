import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { OutcomeTag } from '../../components/Market';
import { Empty, Spinner } from '../../components/ui/Empty';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Select } from '../../components/ui/Select';
import { adminApi } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import {
  callLabel,
  dateTime,
  directionTone,
  price,
  relative,
  signedPips,
  useNow,
} from '../../lib/format';
import { usePrefs } from '../../lib/prefs';
import type {
  AdminOverview,
  AdminSignal,
  AdminUser,
  AdminUserDetail,
  BacktestRunInfo,
} from '../../lib/types';
import { Link } from 'react-router-dom';

const REFRESH_MS = 60_000;

function Check({
  ok,
  label,
  hint,
}: {
  ok: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <div className="admin-check" data-tip={hint}>
      <span className={`dot ${ok ? 'dot-up' : 'dot-down'}`} />
      <span>{label}</span>
      <strong className={ok ? 'up' : 'down'}>{ok ? 'OK' : 'Off'}</strong>
    </div>
  );
}

function uptime(sec: number) {
  const d = Math.floor(sec / 86_400);
  const h = Math.floor((sec % 86_400) / 3_600);
  const m = Math.floor((sec % 3_600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Problems worth attention, worst first. */
function issues(o: AdminOverview, now: number) {
  const list: string[] = [];
  if (!o.server.dbOk) list.push('Database is not responding.');
  if (o.jobs.maintenance && !o.jobs.maintenance.ok)
    list.push(`Last maintenance failed: ${o.jobs.maintenance.error}`);
  if (
    o.jobs.maintenance &&
    now - new Date(o.jobs.maintenance.at).getTime() > 25 * 60_000
  )
    list.push('Maintenance has not run for over 25 minutes.');
  if (
    o.jobs.candleLoopAt &&
    now - new Date(o.jobs.candleLoopAt).getTime() > 5 * 60_000
  )
    list.push('The candle-close loop has not run for over 5 minutes.');
  if (o.credits.usedToday >= o.credits.dailyLimit * 0.85)
    list.push(
      `Data credits at ${o.credits.usedToday}/${o.credits.dailyLimit} today.`
    );
  if (!o.config.liveData)
    list.push('Live data is off (LIVE_DATA_ENABLED / TWELVE_DATA_API_KEY).');
  if (o.alerts.failedToday > 0)
    list.push(`${o.alerts.failedToday} alert deliveries failed today.`);
  const backing = o.series.filter((s) => s.backingOff);
  if (backing.length)
    list.push(
      `Provider backing off for ${backing.map((s) => s.key).join(', ')}.`
    );
  return list;
}

function UserDetail({
  userId,
  onClose,
  onChanged,
}: {
  userId: number;
  onClose: () => void;
  /** Refresh the users table (plan change / delete). */
  onChanged: () => void;
}) {
  const { timeZone } = usePrefs();
  const { user: me } = useAuth();
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const controller = new AbortController();
    adminApi
      .userDetail(userId, controller.signal)
      .then(setDetail)
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : 'Unavailable.');
      });
    return () => controller.abort();
  }, [userId]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  async function setPlan(plan: 'FREE' | 'PRO') {
    if (!detail) return;
    setSaving(true);
    try {
      await adminApi.setPlan(detail.user.id, plan);
      setDetail({
        ...detail,
        user: { ...detail.user, plan },
      });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change plan.');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!detail) return;
    setSaving(true);
    try {
      await adminApi.deleteUser(detail.user.id);
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete user.');
      setSaving(false);
      setConfirmDelete(false);
    }
  }

  const u = detail?.user ?? null;
  const isSelf = me && u && me.id === u.id;

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label="User detail"
        style={{ width: 'min(560px, 100vw)' }}
      >
        <div className="drawer-head">
          <div className="drawer-head-copy">
            <h2>{u ? u.email : 'User'}</h2>
            <span className="faint" style={{ fontSize: 12 }}>
              {u ? `${u.name} · joined ${dateTime(u.createdAt, timeZone)}` : 'Loading…'}
            </span>
          </div>
          <button
            ref={closeRef}
            className="btn btn-secondary drawer-close"
            onClick={onClose}
            aria-label="Close user detail"
          >
            <Icon name="close" size={15} /> Close
          </button>
        </div>
        <div className="drawer-body">
          {error && !detail ? (
            <div className="alert alert-error">{error}</div>
          ) : !detail || !u ? (
            <div className="stack">
              <div className="skeleton" style={{ height: 60 }} />
              <div className="skeleton" style={{ height: 120 }} />
            </div>
          ) : (
            <>
              {error && <div className="alert alert-error">{error}</div>}
              <div className="kv">
                <div>
                  <span>Plan</span>
                  <strong>{u.plan}</strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong>{u.planStatus}</strong>
                </div>
                <div>
                  <span>Last active</span>
                  <strong>{u.lastSeenAt ? relative(u.lastSeenAt, Date.now()) : '—'}</strong>
                </div>
                <div>
                  <span>Push devices</span>
                  <strong>{u.pushDevices.length}</strong>
                </div>
                <div>
                  <span>Unread alerts</span>
                  <strong>{u.unreadNotifications}</strong>
                </div>
                <div>
                  <span>Journal trades</span>
                  <strong>{detail.trades.length} recent</strong>
                </div>
              </div>
              <div className="detail-section">
                <span className="label">Plan</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {saving ? (
                    <Spinner />
                  ) : (
                    <Select
                      label={`Plan for ${u.email}`}
                      value={u.plan === 'PRO' ? 'PRO' : 'FREE'}
                      onChange={(plan) => void setPlan(plan)}
                      options={[
                        { value: 'FREE', label: 'Free' },
                        { value: 'PRO', label: 'Pro' },
                      ]}
                      active={u.plan === 'PRO'}
                      minWidth={120}
                    />
                  )}
                </div>
              </div>
              <div className="detail-section">
                <span className="label">Recent journal trades</span>
                {detail.trades.length === 0 ? (
                  <p className="faint" style={{ fontSize: 13 }}>
                    No trades logged.
                  </p>
                ) : (
                  <div className="table-wrap panel">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Pair</th>
                          <th>Side</th>
                          <th className="r">Entry → exit</th>
                          <th className="r">Pips</th>
                          <th>Close</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.trades.map((t) => (
                          <tr key={t.id}>
                            <td className="strong mono">{t.pairCode}</td>
                            <td>{t.side === 'LONG' ? 'Long' : 'Short'}</td>
                            <td className="r num">
                              {t.entryPrice === null
                                ? '—'
                                : price(t.pairCode, t.entryPrice)}{' '}
                              →{' '}
                              {t.exitPrice === null
                                ? 'open'
                                : price(t.pairCode, t.exitPrice)}
                            </td>
                            <td className="r num">
                              {t.pips === null
                                ? '—'
                                : t.exitReason === 'breakeven'
                                  ? 'BE'
                                  : signedPips(t.pips)}
                            </td>
                            <td className="faint">
                              {t.exitPrice === null
                                ? 'Open'
                                : t.exitReason === 'target'
                                  ? 'Target'
                                  : t.exitReason === 'stop'
                                    ? 'Stop'
                                    : t.exitReason === 'breakeven'
                                      ? 'Breakeven'
                                      : 'Manual'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="detail-section">
                <span className="label">Recent notifications</span>
                {detail.notifications.length === 0 ? (
                  <p className="faint" style={{ fontSize: 13 }}>
                    None.
                  </p>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
                    {detail.notifications.map((n) => (
                      <li key={n.id} className="faint" style={{ fontSize: 12.5 }}>
                        <span className="strong" style={{ color: 'var(--text-2)' }}>
                          {n.read ? '' : '● '}
                          {n.title}
                        </span>{' '}
                        · <span className="mono">{n.kind}</span> ·{' '}
                        {relative(n.createdAt, Date.now())}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="detail-section">
                <span className="label">Danger zone</span>
                <p className="faint" style={{ fontSize: 12.5 }}>
                  {isSelf
                    ? 'You cannot delete your own admin account.'
                    : 'Permanently deletes the account with all trades, alerts and devices. Cannot be undone.'}
                </p>
                <div>
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={saving || !!isSelf}
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete user
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
      {confirmDelete && detail && (
        <ConfirmModal
          title={`Delete ${detail.user.email}?`}
          message="The account, journal trades, notifications and push devices are permanently deleted. This cannot be undone."
          confirmLabel="Delete user"
          danger
          busy={saving}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => void remove()}
        />
      )}
    </>
  );
}

function UsersPanel() {
  const { timeZone } = usePrefs();
  const [q, setQ] = useState('');
  const [plan, setPlanFilter] = useState('ALL');
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const now = useNow(60_000);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const { users: list } = await adminApi.users(q, plan, signal);
        setUsers(list);
        setError(null);
      } catch (err) {
        if (signal?.aborted) return;
        setError(err instanceof Error ? err.message : 'Unavailable.');
      }
    },
    [q, plan]
  );

  useEffect(() => {
    const controller = new AbortController();
    const id = setTimeout(() => void load(controller.signal), 250);
    return () => {
      clearTimeout(id);
      controller.abort();
    };
  }, [load]);

  async function setPlan(user: AdminUser, next: 'FREE' | 'PRO') {
    setSaving(user.id);
    try {
      await adminApi.setPlan(user.id, next);
      setUsers(
        (list) =>
          list?.map((u) => (u.id === user.id ? { ...u, plan: next } : u)) ??
          null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change plan.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Users</h2>
          <p>
            Newest first. Select a row for trades, alerts and account actions.
          </p>
        </div>
        <div className="page-actions">
          <Select
            label="Plan filter"
            value={plan}
            onChange={setPlanFilter}
            options={[
              { value: 'ALL', label: 'All plans' },
              { value: 'FREE', label: 'Free' },
              { value: 'PRO', label: 'Pro' },
            ]}
            active={plan !== 'ALL'}
            minWidth={110}
          />
          <input
            className="input admin-search"
            placeholder="Search email or name"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search users"
          />
        </div>
      </div>
      {error && (
        <div className="alert alert-error" style={{ margin: 16 }}>
          {error}
        </div>
      )}
      {!users ? (
        <div className="panel-body">
          <div className="skeleton" style={{ height: 120 }} />
        </div>
      ) : users.length === 0 ? (
        <Empty icon="user" title="No users found" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Plan</th>
                <th>Joined</th>
                <th>Last active</th>
                <th className="r">Journal</th>
                <th className="r">Alerts</th>
                <th className="r">Push</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => setOpenId(u.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <span className="strong">{u.name}</span>
                    <div className="faint" style={{ fontSize: 12 }}>
                      {u.email}
                    </div>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {saving === u.id ? (
                      <Spinner />
                    ) : (
                      <Select
                        label={`Plan for ${u.email}`}
                        value={u.plan === 'PRO' ? 'PRO' : 'FREE'}
                        onChange={(next) => void setPlan(u, next)}
                        options={[
                          { value: 'FREE', label: 'Free' },
                          { value: 'PRO', label: 'Pro' },
                        ]}
                        active={u.plan === 'PRO'}
                        minWidth={96}
                      />
                    )}
                  </td>
                  <td className="num">{dateTime(u.createdAt, timeZone)}</td>
                  <td className="num">
                    {u.lastSeenAt ? relative(u.lastSeenAt, now) : '—'}
                  </td>
                  <td className="r num">{u.trades}</td>
                  <td className="r num">{u.notifications}</td>
                  <td className="r num">{u.pushDevices}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {openId !== null && (
        <UserDetail
          userId={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => void load()}
        />
      )}
    </section>
  );
}

function BacktestPanel() {
  const { timeZone } = usePrefs();
  const [runs, setRuns] = useState<BacktestRunInfo[] | null>(null);
  const [running, setRunning] = useState(false);
  const [months, setMonths] = useState('6');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await adminApi.backtests();
      setRuns(data.runs);
      setRunning(data.running);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unavailable.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  // Poll while a run is in progress.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => void load(), 5_000);
    return () => clearInterval(id);
  }, [running, load]);

  async function start() {
    setError(null);
    try {
      await adminApi.runBacktest(Number(months));
      setRunning(true);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start.');
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Backtest</h2>
          <p>
            Replays the rules over past months. The newest finished run is
            published on the{' '}
            <Link to="/track-record#backtest">track record</Link>. First run
            costs about 7 data credits per pair per month range; re-runs of the
            same range are free (cached).
          </p>
        </div>
        <div className="page-actions">
          <Select
            label="Months"
            value={months}
            onChange={setMonths}
            options={['1', '3', '6', '9', '12'].map((m) => ({
              value: m,
              label: `${m} month${m === '1' ? '' : 's'}`,
            }))}
            active={false}
            minWidth={120}
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={() => void start()}
            disabled={running}
          >
            {running ? <Spinner /> : null}{' '}
            {running ? 'Running…' : 'Run backtest'}
          </button>
        </div>
      </div>
      {error && (
        <div className="alert alert-error" style={{ margin: 16 }}>
          {error}
        </div>
      )}
      {!runs ? (
        <div className="panel-body">
          <div className="skeleton" style={{ height: 80 }} />
        </div>
      ) : runs.length === 0 ? (
        <Empty icon="activity" title="No backtests yet" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Started</th>
                <th>Range</th>
                <th>Status</th>
                <th className="r">Trades</th>
                <th className="r">Win rate</th>
                <th className="r">Net R</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} title={r.error ?? undefined}>
                  <td className="num">{dateTime(r.createdAt, timeZone)}</td>
                  <td>{r.months} mo</td>
                  <td>
                    <span
                      className={`tag ${r.status === 'DONE' ? 'tag-up' : r.status === 'FAILED' ? 'tag-down' : 'tag-solid'}`}
                    >
                      {r.status === 'DONE'
                        ? 'Done'
                        : r.status === 'FAILED'
                          ? 'Failed'
                          : 'Running'}
                    </span>
                  </td>
                  <td className="r num">{r.summary?.trades ?? '—'}</td>
                  <td className="r num">
                    {r.summary?.winRate === null ||
                    r.summary?.winRate === undefined
                      ? '—'
                      : `${r.summary.winRate.toFixed(0)}%`}
                  </td>
                  <td
                    className={`r num ${(r.summary?.netR ?? 0) > 0 ? 'up' : (r.summary?.netR ?? 0) < 0 ? 'down' : ''}`}
                  >
                    {r.summary
                      ? `${r.summary.netR > 0 ? '+' : ''}${r.summary.netR.toFixed(2)}R`
                      : r.error
                        ? 'error'
                        : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function BroadcastPanel({ totalUsers }: { totalUsers: number }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('ALL');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);

  async function send() {
    setBusy(true);
    try {
      const result = await adminApi.broadcast(
        title.trim(),
        body.trim(),
        audience as 'ALL' | 'FREE' | 'PRO'
      );
      setNotice({
        tone: 'success',
        text: `Sent to ${result.sent} user${result.sent === 1 ? '' : 's'} (${result.audience}).`,
      });
      setTitle('');
      setBody('');
      setConfirming(false);
    } catch (err) {
      setNotice({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Could not send.',
      });
    } finally {
      setBusy(false);
    }
  }

  const valid = title.trim().length >= 3 && body.trim().length >= 3;

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Announcement</h2>
          <p>
            Send a notification to the bell of {totalUsers} user
            {totalUsers === 1 ? '' : 's'}. Use sparingly.
          </p>
        </div>
        <Select
          label="Audience"
          value={audience}
          onChange={setAudience}
          options={[
            { value: 'ALL', label: 'Everyone' },
            { value: 'FREE', label: 'Free only' },
            { value: 'PRO', label: 'Pro only' },
          ]}
          active={audience !== 'ALL'}
          minWidth={120}
        />
      </div>
      <div className="panel-body stack">
        {notice && (
          <div className={`alert alert-${notice.tone}`}>{notice.text}</div>
        )}
        <label className="field">
          <span>Title (3–80 chars)</span>
          <input
            className="input"
            maxLength={80}
            placeholder="e.g. Weekend maintenance tonight"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Message (3–280 chars)</span>
          <textarea
            className="input textarea"
            rows={2}
            maxLength={280}
            placeholder="What should users know?"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        <div>
          <button
            className="btn btn-secondary"
            disabled={!valid || busy}
            onClick={() => setConfirming(true)}
          >
            <Icon name="mail" size={14} /> Send announcement
          </button>
        </div>
      </div>
      {confirming && (
        <ConfirmModal
          title="Send this announcement?"
          message={`"${title.trim()}" goes to the bell of ${audience === 'ALL' ? 'everyone' : `${audience} users`}. It cannot be recalled.`}
          confirmLabel="Send now"
          busy={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={() => void send()}
        />
      )}
    </section>
  );
}

function OpsPanel({ onChanged }: { onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);

  async function run(kind: 'maintenance' | 'loop') {
    setBusy(kind);
    setNotice(null);
    try {
      if (kind === 'maintenance') await adminApi.runMaintenance();
      else await adminApi.runCandleLoop();
      setNotice({
        tone: 'success',
        text:
          kind === 'maintenance'
            ? 'Maintenance pass finished. Signals, settlement and outlook are fresh.'
            : 'Candle-close loop finished. H1 checkpoint, M15 tracking and journal auto-exits ran.',
      });
      onChanged();
    } catch (err) {
      setNotice({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Job failed.',
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Operations</h2>
          <p>Run the background jobs on demand instead of waiting.</p>
        </div>
      </div>
      <div className="panel-body stack">
        {notice && (
          <div className={`alert alert-${notice.tone}`}>{notice.text}</div>
        )}
        <div className="page-actions">
          <button
            className="btn btn-secondary"
            disabled={busy !== null}
            onClick={() => void run('maintenance')}
          >
            {busy === 'maintenance' ? <Spinner /> : <Icon name="refresh" size={14} />}{' '}
            Run maintenance now
          </button>
          <button
            className="btn btn-secondary"
            disabled={busy !== null}
            onClick={() => void run('loop')}
          >
            {busy === 'loop' ? <Spinner /> : <Icon name="bolt" size={14} />}{' '}
            Run candle-close loop
          </button>
        </div>
        <p className="faint" style={{ fontSize: 12.5 }}>
          Maintenance regenerates signals, settles expired windows and prunes
          old notifications. The loop replays M15/H1 closes, announces fills
          and closes journal trades at their stop, target or breakeven.
        </p>
      </div>
    </section>
  );
}

function SignalsPanel() {
  const { timeZone } = usePrefs();
  const [signals, setSignals] = useState<AdminSignal[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    adminApi
      .signals(20, controller.signal)
      .then(({ signals: list }) => setSignals(list))
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : 'Unavailable.');
      });
    return () => controller.abort();
  }, []);

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Recent signals</h2>
          <p>Latest published calls and how each settled.</p>
        </div>
      </div>
      {error ? (
        <div className="alert alert-error" style={{ margin: 16 }}>
          {error}
        </div>
      ) : !signals ? (
        <div className="panel-body">
          <div className="skeleton" style={{ height: 120 }} />
        </div>
      ) : signals.length === 0 ? (
        <Empty icon="signal" title="No signals yet" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Published</th>
                <th>Pair</th>
                <th>Call</th>
                <th>Session</th>
                <th className="r">Conf.</th>
                <th>Result</th>
                <th className="r">Pips</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((s) => (
                <tr key={s.id}>
                  <td className="num">{dateTime(s.validFrom, timeZone)}</td>
                  <td className="strong mono">{s.pairCode}</td>
                  <td>
                    <span className={`tag tag-${directionTone(s.direction)}`}>
                      {callLabel({ direction: s.direction })}
                    </span>
                  </td>
                  <td>{s.session}</td>
                  <td className="r num">{s.confidence}%</td>
                  <td>
                    <OutcomeTag status={s.status} />
                  </td>
                  <td className="r num">
                    {s.movementPips === null ? '—' : signedPips(s.movementPips)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ClearFailuresButton({ onCleared }: { onCleared: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function clear() {
    setBusy(true);
    try {
      await adminApi.clearFailures();
      setConfirming(false);
      onCleared();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setConfirming(true)}
      >
        Clear log
      </button>
      {confirming && (
        <ConfirmModal
          title="Clear failed deliveries?"
          message="The failure log is emptied. Delivery itself is unaffected."
          confirmLabel="Clear log"
          danger
          busy={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={() => void clear()}
        />
      )}
    </>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const { timeZone } = usePrefs();
  const now = useNow(30_000);
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setData(await adminApi.overview(signal));
      setError(null);
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : 'Admin data unavailable.');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => {
      controller.abort();
      clearInterval(id);
    };
  }, [load]);

  if (user && !user.isAdmin) return <Navigate to="/app" replace />;

  const problems = data ? issues(data, now) : [];
  const creditPct = data
    ? Math.min(100, (data.credits.usedToday / data.credits.dailyLimit) * 100)
    : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Admin</h1>
          <p>
            Users, signals, announcements, jobs, data credits, alert delivery
            and server health. Refreshes every minute.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => void load()}>
            <Icon name="refresh" size={14} /> Refresh
          </button>
        </div>
      </div>

      {error && !data ? (
        <div className="panel">
          <Empty icon="shield" title="Admin data unavailable">
            {error}
          </Empty>
        </div>
      ) : !data ? (
        <div className="stack">
          <div className="skeleton" style={{ height: 60 }} />
          <div className="skeleton" style={{ height: 110 }} />
          <div className="skeleton" style={{ height: 260 }} />
        </div>
      ) : (
        <div className="stack">
          <section
            className={`admin-status ${problems.length ? 'bad' : 'good'}`}
            role="status"
          >
            <span
              className={`dot ${problems.length ? 'dot-down' : 'dot-up'}`}
            />
            <div>
              <strong>
                {problems.length
                  ? `${problems.length} thing${problems.length === 1 ? '' : 's'} need${problems.length === 1 ? 's' : ''} attention`
                  : 'All systems normal'}
              </strong>
              {problems.length > 0 && (
                <ul>
                  {problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="kpis">
            <div className="kpi">
              <span className="label">Users</span>
              <div className="kpi-value">{data.counts.users}</div>
              <span className="kpi-note">
                {data.counts.pro} Pro · {data.counts.newThisWeek} new this week
                · {data.counts.activeToday} active today
              </span>
            </div>
            <div className="kpi">
              <span
                className="label"
                data-tip="Twelve Data credits counted by this server today (UTC). The provider resets at midnight UTC."
              >
                Data credits today
              </span>
              <div className="kpi-value">
                {data.credits.usedToday}
                <small> / {data.credits.dailyLimit}</small>
              </div>
              <div className="admin-meter" aria-hidden="true">
                <span
                  className={
                    creditPct > 85 ? 'down' : creditPct > 60 ? 'warn' : 'up'
                  }
                  style={{ width: `${creditPct}%` }}
                />
              </div>
              <span className="kpi-note">
                {data.credits.lastMinute}/{data.credits.perMinuteLimit} in the
                last minute
              </span>
            </div>
            <div className="kpi">
              <span className="label">Alerts today</span>
              <div className="kpi-value">{data.alerts.sentToday}</div>
              <span
                className={`kpi-note ${data.alerts.failedToday ? 'down' : ''}`}
              >
                {data.alerts.failedToday} failed · {data.counts.pushDevices}{' '}
                push devices
              </span>
            </div>
            <div className="kpi">
              <span className="label">Signals</span>
              <div className="kpi-value">{data.signals.publishedToday}</div>
              <span className="kpi-note">
                published today · {data.signals.open} open ·{' '}
                {data.counts.journalTrades} journal trades
              </span>
            </div>
          </section>

          <div className="grid-2" style={{ alignItems: 'start' }}>
            <section className="panel">
              <div className="panel-head">
                <h2>Server health</h2>
              </div>
              <div className="admin-facts">
                <div>
                  <span>Uptime</span>
                  <strong>{uptime(data.server.uptimeSec)}</strong>
                </div>
                <div>
                  <span>Memory</span>
                  <strong>{data.server.memoryMb} MB</strong>
                </div>
                <div>
                  <span>Database</span>
                  <strong className={data.server.dbOk ? 'up' : 'down'}>
                    {data.server.dbOk
                      ? `${data.server.dbLatencyMs} ms`
                      : 'Down'}
                  </strong>
                </div>
                <div>
                  <span>Node</span>
                  <strong>{data.server.node}</strong>
                </div>
                <div>
                  <span>Maintenance</span>
                  <strong
                    className={
                      data.jobs.maintenance?.ok === false ? 'down' : ''
                    }
                  >
                    {data.jobs.maintenance
                      ? `${relative(data.jobs.maintenance.at, now)} · ${(data.jobs.maintenance.ms / 1000).toFixed(1)}s`
                      : 'Not yet'}
                  </strong>
                </div>
                <div>
                  <span>Candle loop</span>
                  <strong>
                    {data.jobs.candleLoopAt
                      ? relative(data.jobs.candleLoopAt, now)
                      : 'Not yet'}
                  </strong>
                </div>
              </div>
              <div className="admin-checks">
                <Check
                  ok={data.config.liveData}
                  label="Live market data"
                  hint="LIVE_DATA_ENABLED and TWELVE_DATA_API_KEY"
                />
                <Check
                  ok={data.config.calendar}
                  label="Economic calendar"
                  hint="TRADING_ECONOMICS_API_KEY"
                />
                <Check
                  ok={data.config.modelReview}
                  label="Model review"
                  hint="AI_ANALYSIS_ENABLED and DEEPSEEK_API_KEY"
                />
                <Check
                  ok={data.config.email}
                  label="Email alerts"
                  hint="SMTP_* settings"
                />
                <Check
                  ok={data.config.push}
                  label="Push alerts"
                  hint="VAPID_* keys"
                />
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Market data</h2>
                  <p>Newest candle in each cached series</p>
                </div>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Series</th>
                      <th>Newest candle</th>
                      <th className="r">Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.series.map((s) => (
                      <tr key={s.key}>
                        <td className="mono strong">{s.key}</td>
                        <td className="num faint">{s.newest ?? '—'}</td>
                        <td
                          className={`r num ${s.backingOff || s.stale ? 'down' : ''}`}
                        >
                          {s.ageMinutes === null
                            ? '—'
                            : s.ageMinutes < 120
                              ? `${s.ageMinutes}m`
                              : `${Math.round(s.ageMinutes / 60)}h`}
                          {s.backingOff ? ' · backing off' : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="admin-lastsignals">
                {data.signals.lastByPair.map((s) => (
                  <div key={s.pairCode}>
                    <span className="mono strong">{s.pairCode}</span>
                    <span className="faint">
                      last signal {relative(s.at, now)} ·{' '}
                      {s.direction.toLowerCase()}
                    </span>
                    <OutcomeTag status={s.status} />
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Failed alerts</h2>
                <p>Email and push deliveries that did not go through</p>
              </div>
              {data.alerts.failures.length > 0 && (
                <ClearFailuresButton onCleared={() => void load()} />
              )}
            </div>
            {data.alerts.failures.length === 0 ? (
              <Empty icon="check" title="No failed deliveries" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Channel</th>
                      <th>Alert</th>
                      <th>User</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.alerts.failures.map((f) => (
                      <tr key={f.id}>
                        <td className="num">
                          {dateTime(f.createdAt, timeZone)}
                        </td>
                        <td>{f.channel}</td>
                        <td className="mono">{f.kind}</td>
                        <td className="num">{f.userId ?? '—'}</td>
                        <td className="faint" style={{ maxWidth: 420 }}>
                          {f.error}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="grid-2" style={{ alignItems: 'start' }}>
            <OpsPanel onChanged={() => void load()} />
            <BroadcastPanel totalUsers={data.counts.users} />
          </div>

          <SignalsPanel />

          <BacktestPanel />

          <UsersPanel />
        </div>
      )}
    </>
  );
}
