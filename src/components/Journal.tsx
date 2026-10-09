import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { OutcomeTag } from './Market';
import { SignalDrawer } from './SignalDrawer';
import { Select, type SelectOption } from './ui/Select';
import { Empty } from './ui/Empty';
import { getHistory } from '../lib/api';
import {
  dayDate,
  callLabel,
  directionTone,
  price,
  signedPips,
  time,
  tzLabel,
} from '../lib/format';
import { usePrefs } from '../lib/prefs';
import type { HistoryPage, OutcomeStatus, PairCode } from '../lib/types';

const RANGES = [
  { days: 1, label: '24h' },
  { days: 7, label: '7d' },
  { days: 30, label: '30d' },
  { days: 365, label: '1y' },
];

// Hours mirror the backend's signal windows (market.WINDOW_SCHEDULE), in UTC.
const SESSION_OPTIONS: SelectOption<string>[] = [
  { value: '', label: 'All sessions' },
  { value: 'Asia', label: 'Asia', hint: '00–07 UTC' },
  { value: 'London', label: 'London', hint: '07–12 UTC' },
  { value: 'New York', label: 'New York', hint: '12–17 UTC' },
  // Labels used before session-aligned windows; kept so old signals filter.
  { value: 'Tokyo', label: 'Tokyo', hint: 'older' },
  { value: 'London / New York', label: 'London / New York', hint: 'older' },
  { value: 'Asia pre-open', label: 'Asia pre-open', hint: 'older' },
];

const PAIR_OPTIONS: SelectOption<'' | PairCode>[] = [
  { value: '', label: 'All pairs' },
  { value: 'EUR/USD', label: 'EUR/USD' },
  { value: 'USD/JPY', label: 'USD/JPY' },
];

const RESULT_OPTIONS: SelectOption<'' | OutcomeStatus>[] = [
  { value: '', label: 'All results' },
  { value: 'HIT', label: 'Target' },
  { value: 'MISSED', label: 'Stopped' },
  { value: 'CLOSED_EARLY', label: 'Closed early' },
  { value: 'BREAKEVEN', label: 'Breakeven' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'PENDING', label: 'Open' },
];

export function Journal() {
  const { timeZone } = usePrefs();
  const [days, setDays] = useState(7);
  const [pair, setPair] = useState<'' | PairCode>('');
  const [session, setSession] = useState('');
  const [result, setResult] = useState<'' | OutcomeStatus>('');
  const [page, setPage] = useState<HistoryPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    getHistory(
      {
        days,
        pair: pair || undefined,
        session: session || undefined,
        limit: 200,
      },
      controller.signal
    )
      .then((next) => {
        setPage(next);
        setError(null);
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(
            err instanceof Error
              ? err.message
              : 'Signal history is unavailable.'
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [days, pair, session]);

  const rows = useMemo(
    () =>
      (page?.items ?? []).filter(
        (p) => !result || (p.outcome?.status ?? 'PENDING') === result
      ),
    [page, result]
  );
  const selected = rows.find((p) => p.id === openId) ?? null;

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Signal history</h2>
          <p>
            Every published signal with its levels and how the price path
            settled it
          </p>
        </div>
      </div>
      <div className="toolbar">
        <div className="segmented" aria-label="Range">
          {RANGES.map((range) => (
            <button
              key={range.days}
              aria-pressed={days === range.days}
              onClick={() => setDays(range.days)}
            >
              {range.label}
            </button>
          ))}
        </div>
        <Select
          label="Pair"
          value={pair}
          onChange={setPair}
          options={PAIR_OPTIONS}
          minWidth={150}
        />
        <Select
          label="Session"
          value={session}
          onChange={setSession}
          options={SESSION_OPTIONS}
          minWidth={250}
        />
        <Select
          label="Result"
          value={result}
          onChange={setResult}
          options={RESULT_OPTIONS}
          minWidth={150}
        />
      </div>

      {page?.capped && (
        <div className="alert" style={{ margin: '12px 18px 0' }}>
          <Icon name="lock" size={14} />
          <div>
            Showing the last <strong>{page.appliedDays} days</strong> — the
            limit on the {page.plan === 'PRO' ? 'Pro' : 'Free'} plan.{' '}
            <Link to="/app/billing" className="link">
              Pro keeps 365 days.
            </Link>
          </div>
        </div>
      )}

      {error ? (
        <Empty icon="activity" title="Journal unavailable">
          {error}
        </Empty>
      ) : loading && !page ? (
        <div className="panel-body stack">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 34 }} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Empty icon="activity" title="No signals in this range">
          {(page?.items.length ?? 0) > 0
            ? 'Nothing matches the result filter.'
            : 'Signals appear here after their window closes and the price path has been replayed.'}
        </Empty>
      ) : (
        <div className="table-wrap" style={{ opacity: loading ? 0.6 : 1 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Published</th>
                <th>Pair</th>
                <th data-tip="The engine's call: Long (buy), Short (sell) or Neutral (no trade).">
                  Call
                </th>
                <th>Session</th>
                <th
                  className="r"
                  data-tip="Middle of the entry zone, where fills are assumed."
                >
                  Entry
                </th>
                <th className="r">Target</th>
                <th className="r">Stop</th>
                <th
                  className="r"
                  data-tip="Confidence: how strongly the timeframes agreed. Not a win probability."
                >
                  Conf.
                </th>
                <th>Result</th>
                <th
                  className="r"
                  data-tip="Result in pips, signed in the trade direction (+ is profit), from the middle of the entry zone."
                >
                  Pips
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const move = p.outcome?.movementPips ?? null;
                return (
                  <tr
                    key={p.id}
                    onClick={() => setOpenId(p.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <span className="strong">
                        {dayDate(p.validFrom, timeZone)}
                      </span>{' '}
                      <span className="num faint">
                        {time(p.validFrom, timeZone)}
                      </span>
                    </td>
                    <td className="strong mono">{p.pairCode}</td>
                    <td>
                      <span className={`tag tag-${directionTone(p.direction)}`}>
                        {callLabel(p)}
                      </span>
                    </td>
                    <td>{p.session}</td>
                    <td className="r num">
                      {price(p.pairCode, (p.entryLow + p.entryHigh) / 2)}
                    </td>
                    <td className="r num">
                      {price(p.pairCode, p.targetPrice)}
                    </td>
                    <td className="r num">
                      {price(p.pairCode, p.invalidationPrice)}
                    </td>
                    <td className="r num">{p.confidence}%</td>
                    <td>
                      <OutcomeTag status={p.outcome?.status ?? 'PENDING'} />
                    </td>
                    <td
                      className={`r num ${move === null ? 'faint' : move > 0 ? 'up' : move < 0 ? 'down' : ''}`}
                    >
                      {move === null ? '—' : signedPips(move)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="footnote">
        <Icon name="info" size={13} />
        Times in {tzLabel(timeZone)}. Entry shows the middle of the zone; pips
        are signed in the trade's direction. Select a row for the full
        reasoning.
      </div>

      {selected && (
        <SignalDrawer prediction={selected} onClose={() => setOpenId(null)} />
      )}
    </section>
  );
}
