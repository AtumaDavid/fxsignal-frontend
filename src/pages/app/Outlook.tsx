import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { engineLabel } from '../../components/SignalTicket';
import { OutlookChart } from '../../components/Charts';
import { Empty, Spinner } from '../../components/ui/Empty';
import { getWeeklyOutlook } from '../../lib/api';
import { useDashboard } from '../../lib/dashboard';
import {
  dateTime,
  directionTone,
  price,
  pipsBetween,
  tzLabel,
} from '../../lib/format';
import { usePrefs } from '../../lib/prefs';
import type { PairCode, WeeklyOutlook } from '../../lib/types';
import { lastPrice } from './Overview';

function biasLabel(bias: WeeklyOutlook['bias']) {
  return bias === 'BULLISH'
    ? 'Bullish'
    : bias === 'BEARISH'
      ? 'Bearish'
      : 'Neutral';
}

function weekRange(outlook: WeeklyOutlook) {
  const fmt = (value: string) =>
    new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(value));
  return `${fmt(outlook.weekStart)} – ${fmt(outlook.weekEnd)}`;
}

/** Compact card for the overview while the market is closed. */
export function OutlookSummary({
  outlook,
  last,
}: {
  outlook: WeeklyOutlook;
  last: number | null;
}) {
  const tone = directionTone(outlook.bias);
  const nearestRes = outlook.resistances
    .filter((r) => last === null || r > last)
    .sort((a, b) => a - b)[0];
  const nearestSup = outlook.supports
    .filter((s) => last === null || s < last)
    .sort((a, b) => b - a)[0];
  return (
    <article className="ticket">
      <div className="ticket-head">
        <div className="ticket-pair">
          <div>
            <h3>{outlook.pairCode}</h3>
            <p>Week of {weekRange(outlook)}</p>
          </div>
        </div>
        <span className={`tag tag-${tone}`}>{biasLabel(outlook.bias)}</span>
      </div>
      <div className="panel-body stack" style={{ gap: 14 }}>
        <p style={{ fontSize: 15, lineHeight: 1.45, fontWeight: 500 }}>
          {outlook.headline}
        </p>
        <div className="ticket-confidence" style={{ maxWidth: 'none' }}>
          <div className="ticket-confidence-top">
            <span>Conviction</span>
            <span className="num">{outlook.confidence}%</span>
          </div>
          <div className="meter meter-ink">
            <span style={{ width: `${outlook.confidence}%` }} />
          </div>
        </div>
      </div>
      <div
        className="ticket-stats"
        style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
      >
        <div>
          <span>Resistance</span>
          <strong>{price(outlook.pairCode, nearestRes)}</strong>
        </div>
        <div>
          <span>Last</span>
          <strong>{price(outlook.pairCode, last)}</strong>
        </div>
        <div>
          <span>Support</span>
          <strong>{price(outlook.pairCode, nearestSup)}</strong>
        </div>
      </div>
      <div className="ticket-foot">
        <span className="grow">{engineLabel(outlook.engine)}</span>
        <Link
          to={`/app/outlook?pair=${encodeURIComponent(outlook.pairCode)}`}
          className="btn btn-secondary btn-sm"
        >
          Week plan <Icon name="arrowRight" size={13} />
        </Link>
      </div>
    </article>
  );
}

function Levels({
  outlook,
  last,
}: {
  outlook: WeeklyOutlook;
  last: number | null;
}) {
  const pair = outlook.pairCode;
  const rows = [
    ...outlook.resistances.map((value) => ({ value, kind: 'res' as const })),
    ...outlook.supports.map((value) => ({ value, kind: 'sup' as const })),
    ...(last !== null ? [{ value: last, kind: 'now' as const }] : []),
  ].sort((a, b) => b.value - a.value);

  if (rows.length === 0)
    return <p className="faint">No confirmed swing levels yet.</p>;
  return (
    <div className="levels">
      {rows.map((row) => (
        <div key={`${row.kind}-${row.value}`} className={`level ${row.kind}`}>
          <span>
            {row.kind === 'res'
              ? 'Resistance'
              : row.kind === 'sup'
                ? 'Support'
                : 'Last price'}
          </span>
          <strong>{price(pair, row.value)}</strong>
          <em>
            {row.kind === 'now' || last === null
              ? ''
              : `${pipsBetween(pair, row.value, last) > 0 ? '+' : '−'}${Math.abs(pipsBetween(pair, row.value, last)).toFixed(0)}p`}
          </em>
        </div>
      ))}
    </div>
  );
}

export default function Outlook() {
  const { data } = useDashboard();
  const { timeZone } = usePrefs();
  const initial = data?.weeklyOutlook ?? [];
  const [fetched, setFetched] = useState<WeeklyOutlook[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const pair: PairCode =
    params.get('pair') === 'USD/JPY' ? 'USD/JPY' : 'EUR/USD';
  const setPair = (next: PairCode) =>
    setParams({ pair: next }, { replace: true });

  const load = () => {
    setLoading(true);
    setError(null);
    getWeeklyOutlook()
      .then(setFetched)
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : 'The outlook is unavailable.'
        )
      )
      .finally(() => setLoading(false));
  };

  // The dashboard already carries this week's outlook; only ask the outlook
  // endpoint (which can trigger a generation pass) when it is missing.
  useEffect(() => {
    if (data && data.weeklyOutlook.length === 0 && fetched === null) load();
  }, [data]);

  const outlooks = initial.length > 0 ? initial : (fetched ?? []);
  const active = outlooks.find((o) => o.pairCode === pair) ?? outlooks[0];
  const last = active ? lastPrice(data, active.pairCode) : null;
  const tone = active ? directionTone(active.bias) : 'flat';

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">
            {active
              ? `${active.weekKey} · ${weekRange(active)}`
              : 'Weekly preparation'}
          </div>
          <h1>Week ahead</h1>
          <p>
            Top-down preparation for the trading week: monthly to hourly
            structure, the levels worth marking, three scenarios and the
            scheduled catalysts.
          </p>
        </div>
        {outlooks.length > 1 && (
          <div className="segmented" role="tablist" aria-label="Pair">
            {outlooks.map((o) => (
              <button
                key={o.pairCode}
                role="tab"
                aria-selected={active?.pairCode === o.pairCode}
                onClick={() => setPair(o.pairCode)}
              >
                {o.pairCode}
              </button>
            ))}
          </div>
        )}
      </div>

      {!active ? (
        <div className="panel">
          {loading || !data ? (
            <Empty icon="layers" title="Loading the outlook…" />
          ) : (
            <Empty
              icon="layers"
              title="No outlook for this week yet"
              action={
                <button
                  className="btn btn-secondary"
                  onClick={load}
                  disabled={loading}
                >
                  {loading ? <Spinner /> : <Icon name="refresh" size={13} />}{' '}
                  Check again
                </button>
              }
            >
              {error ??
                'The outlook is generated by the background job from higher-timeframe data and the week-ahead calendar.'}
            </Empty>
          )}
        </div>
      ) : (
        <article className="panel">
          <div className="outlook-head">
            <div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className={`tag tag-${tone}`}>
                  {biasLabel(active.bias)}
                </span>
                <span className="tag">{engineLabel(active.engine)}</span>
              </div>
              <h2>{active.headline}</h2>
            </div>
            <div className="conviction">
              <span className="label">Conviction</span>
              <span className="num">{active.confidence}%</span>
              <div className="meter meter-ink">
                <span style={{ width: `${active.confidence}%` }} />
              </div>
            </div>
          </div>

          <div style={{ borderBottom: '1px solid var(--line)' }}>
            <OutlookChart outlook={active} key={active.id} />
          </div>

          <div className="outlook-body">
            <div>
              <section className="detail-section">
                <span className="label">Top-down read</span>
                <p className="prose">{active.narrative}</p>
              </section>
              <section className="detail-section">
                <span className="label">Scenarios</span>
                <div>
                  {(['bull', 'base', 'bear'] as const).map((key) => (
                    <div className="scenario" key={key}>
                      <b
                        className={
                          key === 'bull' ? 'up' : key === 'bear' ? 'down' : ''
                        }
                      >
                        {key === 'bull'
                          ? 'Bull'
                          : key === 'bear'
                            ? 'Bear'
                            : 'Base'}
                      </b>
                      <p>{active.scenarios[key].trigger}</p>
                      <span className="num">
                        → {price(active.pairCode, active.scenarios[key].target)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
              <section className="detail-section">
                <span className="label">Day-trader plan</span>
                <div className="callout">{active.tradingPlan}</div>
              </section>
            </div>
            <div>
              <section className="detail-section">
                <span className="label">Levels to mark</span>
                <Levels outlook={active} last={last} />
              </section>
              <section className="detail-section">
                <span className="label">Catalysts</span>
                <ul className="factor-list">
                  {active.catalysts.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </section>
              <p className="faint" style={{ fontSize: 12 }}>
                Generated {dateTime(active.createdAt, timeZone)}{' '}
                {tzLabel(timeZone)}
                {active.modelName ? ` · ${active.modelName}` : ''}
              </p>
            </div>
          </div>
        </article>
      )}
    </>
  );
}
