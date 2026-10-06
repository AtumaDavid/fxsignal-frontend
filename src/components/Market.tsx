import { Icon } from './Icon';
import { Spinner } from './ui/Empty';
import { useDashboard } from '../lib/dashboard';
import {
  dayDate,
  duration,
  hourRange,
  localDiffersFromUtc,
  relative,
  time,
  tzLabel,
  useNow,
  utcHourAs,
} from '../lib/format';
import { usePrefs } from '../lib/prefs';
import type { Impact, MarketEvent, OutcomeStatus } from '../lib/types';

// Mirrors backend getSession() (labels on signals) and sessionInfo() (killzones).
// The signal windows (mirrors backend market.WINDOW_SCHEDULE).
const SESSIONS = [
  { name: 'Asia', start: 0, end: 7 },
  { name: 'London', start: 7, end: 12 },
  { name: 'New York', start: 12, end: 17 },
  { name: 'No new signals', start: 17, end: 24 },
];
const KILLZONES = [
  { name: 'London KZ', start: 7, end: 10 },
  { name: 'New York KZ', start: 12, end: 15 },
];
// Signal windows open at the session starts (Asia, London, New York); nothing
// new is published 17:00–24:00 UTC. Mirrors backend market.WINDOW_SCHEDULE.
const SIGNAL_WINDOWS = [0, 7, 12];
const SCALE = [0, 3, 6, 9, 12, 15, 18, 21, 24];

export function SessionMap({ marketOpen }: { marketOpen: boolean }) {
  const now = useNow(30_000);
  const { timeZone } = usePrefs();
  const showLocal = timeZone === 'local' && localDiffersFromUtc();
  const bandTitle = (b: { name: string; start: number; end: number }) =>
    `${b.name}: ${hourRange(b.start, b.end, 'utc')} UTC` +
    (showLocal
      ? ` (${hourRange(b.start, b.end, 'local')} ${tzLabel('local')})`
      : '');
  const d = new Date(now);
  const hour = d.getUTCHours() + d.getUTCMinutes() / 60;
  const pct = (h: number) => `${(h / 24) * 100}%`;
  const live = (s: { start: number; end: number }) =>
    marketOpen && hour >= s.start && hour < s.end;
  const session = SESSIONS.find(live);
  const killzone = KILLZONES.find(live);
  const nextKz = KILLZONES.map((k) => ({
    ...k,
    inHours: (k.start - hour + 24) % 24 || 24,
  })).sort((a, b) => a.inHours - b.inHours)[0];
  // Prefer the server's schedule (it knows about Friday evenings and weekends).
  const { data } = useDashboard();
  const serverNext = data?.stats.nextRefresh
    ? new Date(data.stats.nextRefresh).getTime() - now
    : NaN;
  const nextWindowMs =
    Number.isFinite(serverNext) && serverNext > 0
      ? serverNext
      : SIGNAL_WINDOWS.map((w) => (w - hour + 24) % 24 || 24).sort(
          (a, b) => a - b
        )[0] * 3_600_000;

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Session map</h2>
          <p>
            Today in UTC
            {showLocal ? ` with ${tzLabel('local')} below` : ''} · signals at
            Asia {utcHourAs(0, showLocal ? 'local' : 'utc')}, London{' '}
            {utcHourAs(7, showLocal ? 'local' : 'utc')}, New York{' '}
            {utcHourAs(12, showLocal ? 'local' : 'utc')}
            {showLocal ? ` ${tzLabel('local')}` : ' UTC'} · none after{' '}
            {utcHourAs(17, showLocal ? 'local' : 'utc')}
          </p>
        </div>
        <span className="tag">
          {marketOpen ? (session?.name ?? 'Open') : 'Closed'}
        </span>
      </div>
      <div className="panel-body">
        <div className="sessions-wrap">
          <span className="sessions-rowlabel" style={{ top: 0 }}>
            Session
          </span>
          <span className="sessions-rowlabel" style={{ top: 18 }}>
            Killzone
          </span>
          <div
            className="sessions-bar"
            role="img"
            aria-label="Trading sessions and killzones across the UTC day"
          >
            <div className="sessions-row r1">
              {SESSIONS.map((s) => (
                <span
                  key={s.name}
                  title={bandTitle(s)}
                  className={`session-band${live(s) ? ' is-live' : ''}`}
                  style={{
                    left: pct(s.start),
                    width: `calc(${pct(s.end - s.start)} - 2px)`,
                  }}
                >
                  {s.name}
                </span>
              ))}
            </div>
            <div className="sessions-row r2">
              {KILLZONES.map((k) => (
                <span
                  key={k.name}
                  title={bandTitle(k)}
                  className={`session-band kz${live(k) ? ' is-live' : ''}`}
                  style={{
                    left: pct(k.start),
                    width: `calc(${pct(k.end - k.start)} - 2px)`,
                  }}
                >
                  {k.name}
                </span>
              ))}
            </div>
            {!marketOpen && (
              <span className="sessions-closed" style={{ left: 0, right: 0 }} />
            )}
            <span className="sessions-now" style={{ left: pct(hour) }} />
          </div>
          <div className="sessions-scale" aria-hidden="true">
            {SCALE.map((h) => (
              <span key={h} style={{ left: `${(h / 24) * 100}%` }}>
                {utcHourAs(h, 'utc')}
              </span>
            ))}
            <em>UTC</em>
          </div>
          {showLocal && (
            <div className="sessions-scale local" aria-hidden="true">
              {SCALE.map((h) => (
                <span key={h} style={{ left: `${(h / 24) * 100}%` }}>
                  {utcHourAs(h, 'local')}
                </span>
              ))}
              <em>{tzLabel('local')}</em>
            </div>
          )}
        </div>
        <div className="sessions-legend">
          {marketOpen ? (
            <>
              <span>
                Now <b>{session?.name ?? '—'}</b>
                {killzone && (
                  <>
                    {' '}
                    · <b>{killzone.name}</b> ends in{' '}
                    {duration((killzone.end - hour) * 3_600_000)}
                  </>
                )}
              </span>
              {!killzone && nextKz && (
                <span>
                  Next killzone <b>{nextKz.name}</b> in{' '}
                  {duration(nextKz.inHours * 3_600_000)}
                </span>
              )}
              <span>
                Next signal window in <b>{duration(nextWindowMs)}</b>
              </span>
            </>
          ) : (
            <span>
              Spot FX is closed from Friday 22:00 to Sunday 22:00 UTC. No
              intraday signals are published.
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

export function ImpactBars({ impact }: { impact: Impact }) {
  const level = impact === 'HIGH' ? 3 : impact === 'MEDIUM' ? 2 : 1;
  return (
    <span
      className={`impact lvl-${level}`}
      title={`${impact.toLowerCase()} impact`}
    >
      <i />
      <i />
      <i />
      <span className="visually-hidden">{impact.toLowerCase()} impact</span>
    </span>
  );
}

export function EventRow({
  event,
  showDay = false,
}: {
  event: MarketEvent;
  showDay?: boolean;
}) {
  const { timeZone } = usePrefs();
  const now = useNow(60_000);
  const detail = [
    event.forecast ? `Fcst ${event.forecast}` : null,
    event.previousValue ? `Prev ${event.previousValue}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="row">
      <span className="ccy">{event.currency}</span>
      <div style={{ minWidth: 0 }}>
        <div className="row-title">{event.title}</div>
        <div className="row-sub">{detail || 'No consensus published'}</div>
      </div>
      <div className="row-end">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            justifyContent: 'flex-end',
          }}
        >
          <ImpactBars impact={event.impact} />
          <span className="num" style={{ color: 'var(--text)' }}>
            {showDay ? `${dayDate(event.eventDate, timeZone)} ` : ''}
            {time(event.eventDate, timeZone)}
          </span>
        </div>
        <div className="faint">{relative(event.eventDate, now)}</div>
      </div>
    </div>
  );
}

const OUTCOME = {
  HIT: { label: 'Target', cls: 'tag-up' },
  MISSED: { label: 'Stopped', cls: 'tag-down' },
  EXPIRED: { label: 'Expired', cls: '' },
  PENDING: { label: 'Open', cls: 'tag-solid' },
} as const;

export function OutcomeTag({ status }: { status: OutcomeStatus }) {
  const meta = OUTCOME[status];
  return <span className={`tag ${meta.cls}`}>{meta.label}</span>;
}

/**
 * Honest feed state: says exactly why there is no data and offers a forced
 * retry (rate-limited by the API) when that could help.
 */
export function FeedBanner() {
  const { data, error, retry, retrying } = useDashboard();
  const { timeZone } = usePrefs();
  if (!error && (!data || data.dataAvailable || data.marketStatus === 'CLOSED'))
    return null;

  const title = error
    ? 'The market feed is unreachable'
    : data?.liveDataEnabled
      ? 'Waiting on the data providers'
      : 'Live market data is not configured';
  const body = error
    ? error
    : data?.liveDataEnabled
      ? 'The providers have not returned usable data yet. The background job retries every 10 minutes; nothing simulated is shown in the meantime.'
      : 'Set LIVE_DATA_ENABLED=true and add the Twelve Data key to backend/.env, then restart the API.';

  return (
    <div className="alert" role="status">
      <Icon name="info" size={15} />
      <div>
        <strong>{title}</strong>
        <div>{body}</div>
        {data && !error && (
          <div className="faint" style={{ marginTop: 2, fontSize: 12 }}>
            Checked {time(data.generatedAt, timeZone)} {tzLabel(timeZone)}
          </div>
        )}
      </div>
      <button
        className="btn btn-secondary btn-sm alert-action"
        onClick={() => void retry()}
        disabled={retrying}
      >
        {retrying ? <Spinner size={13} /> : <Icon name="refresh" size={13} />}
        {retrying ? 'Retrying…' : 'Retry now'}
      </button>
    </div>
  );
}
