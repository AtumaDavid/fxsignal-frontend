import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { OutcomeTag } from '../../components/Market';
import { Empty, Spinner } from '../../components/ui/Empty';
import { Select } from '../../components/ui/Select';
import { adminApi } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { dateTime, relative, useNow } from '../../lib/format';
import { usePrefs } from '../../lib/prefs';
import type {
  AdminOverview,
  AdminUser,
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

function UsersPanel() {
  const { timeZone } = usePrefs();
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const now = useNow(60_000);

  useEffect(() => {
    const controller = new AbortController();
    const id = setTimeout(() => {
      adminApi
        .users(q, controller.signal)
        .then(({ users: list }) => setUsers(list))
        .catch((err) => {
          if (!controller.signal.aborted)
            setError(err instanceof Error ? err.message : 'Unavailable.');
        });
    }, 250);
    return () => {
      clearTimeout(id);
      controller.abort();
    };
  }, [q]);

  async function setPlan(user: AdminUser, plan: 'FREE' | 'PRO') {
    setSaving(user.id);
    try {
      await adminApi.setPlan(user.id, plan);
      setUsers(
        (list) =>
          list?.map((u) => (u.id === user.id ? { ...u, plan } : u)) ?? null
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
          <p>Newest first. Change a plan by hand until payments are live.</p>
        </div>
        <input
          className="input admin-search"
          placeholder="Search email or name"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search users"
        />
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
                <th className="r">Push devices</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <span className="strong">{u.name}</span>
                    <div className="faint" style={{ fontSize: 12 }}>
                      {u.email}
                    </div>
                  </td>
                  <td>
                    {saving === u.id ? (
                      <Spinner />
                    ) : (
                      <Select
                        label={`Plan for ${u.email}`}
                        value={u.plan === 'PRO' ? 'PRO' : 'FREE'}
                        onChange={(plan) => void setPlan(u, plan)}
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
                  <td className="r num">{u.pushDevices}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
            Users, data credits, alert delivery and server health. Refreshes
            every minute.
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

          <BacktestPanel />

          <UsersPanel />
        </div>
      )}
    </>
  );
}
