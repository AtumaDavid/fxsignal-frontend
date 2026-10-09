import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { OutcomeTag } from '../components/Market';
import { PipsChart } from '../components/PipsChart';
import { Brand } from '../components/ui/Brand';
import { Empty } from '../components/ui/Empty';
import { getPublicTrackRecord } from '../lib/api';
import {
  dayDate,
  directionLabel,
  directionTone,
  price,
  signedPips,
  time,
  tzLabel,
} from '../lib/format';
import { usePrefs } from '../lib/prefs';
import type { PublicTrackRecord } from '../lib/types';
import { Breakdown } from './app/Performance';
import { Nav } from './Landing';

const WINDOWS = [30, 90, 365] as const;

/**
 * Public, shareable track record: the same scored results signed-in users
 * see, with nothing filtered out.
 */
export default function TrackRecord() {
  const { timeZone } = usePrefs();
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(90);
  const [record, setRecord] = useState<PublicTrackRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.title = 'Track record — FXSignal';
    return () => {
      document.title = 'FXSignal — Intraday FX reads you can check';
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    getPublicTrackRecord(days, controller.signal)
      .then(setRecord)
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(
            err instanceof Error
              ? err.message
              : 'The track record is unavailable.'
          );
      });
    return () => controller.abort();
  }, [days]);

  async function share() {
    const url = `${window.location.origin}/track-record`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link', url);
    }
  }

  const t = record?.totals;

  return (
    <div className="lp">
      <Nav />
      <main
        className="lp-container"
        style={{ paddingTop: 56, paddingBottom: 96 }}
      >
        <div className="page-head">
          <div>
            <div className="eyebrow">
              <span className="dot dot-live" /> Public · updated every 5 minutes
            </div>
            <h1 style={{ fontSize: 34, letterSpacing: '-0.035em' }}>
              Track record
            </h1>
            <p>
              Every signal FXSignal published, replayed against the price path
              after its window closed. Losing calls stay in. Only trades whose
              entry zone actually traded count toward the hit rate.
            </p>
          </div>
          <div className="page-actions">
            <div className="segmented" aria-label="Window">
              {WINDOWS.map((w) => (
                <button
                  key={w}
                  aria-pressed={days === w}
                  onClick={() => setDays(w)}
                >
                  {w === 365 ? '1 year' : `${w} days`}
                </button>
              ))}
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => void share()}
            >
              <Icon name={copied ? 'check' : 'external'} size={13} />
              {copied ? 'Link copied' : 'Copy link'}
            </button>
          </div>
        </div>

        {error ? (
          <div className="panel">
            <Empty icon="activity" title="Track record unavailable">
              {error}
            </Empty>
          </div>
        ) : (
          <div className="stack">
            <section className="kpis" aria-label="Summary">
              <div className="kpi">
                <span className="label">Hit rate</span>
                <div className="kpi-value">
                  {t?.hitRate != null ? (
                    <>
                      {t.hitRate.toFixed(1)}
                      <small>%</small>
                    </>
                  ) : (
                    '—'
                  )}
                </div>
                <span className="kpi-note">
                  {t ? `${t.hits} targets · ${t.misses} stops` : '—'}
                </span>
              </div>
              <div className="kpi">
                <span className="label">Net pips</span>
                <div
                  className={`kpi-value ${t && t.netPips > 0 ? 'up' : t && t.netPips < 0 ? 'down' : ''}`}
                >
                  {t ? signedPips(t.netPips) : '—'}
                </div>
                <span className="kpi-note">Scored trades, both pairs</span>
              </div>
              <div className="kpi">
                <span className="label">Signals published</span>
                <div className="kpi-value">{t?.signals ?? '—'}</div>
                <span className="kpi-note">
                  {t
                    ? `${t.closedEarly ?? 0} closed early · ${t.cancelled ?? 0} cancelled · ${t.neutral} neutral · ${t.notTriggered} not triggered`
                    : '—'}
                </span>
              </div>
              <div className="kpi">
                <span className="label">Window</span>
                <div className="kpi-value">
                  {days}
                  <small>days</small>
                </div>
                <span className="kpi-note">EUR/USD and USD/JPY</span>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Cumulative net pips</h2>
                  <p>Steps at each settlement · scored trades only</p>
                </div>
              </div>
              {!record ? (
                <div className="panel-body">
                  <div className="skeleton" style={{ height: 200 }} />
                </div>
              ) : record.curve.length > 0 ? (
                <PipsChart curve={record.curve} timeZone={timeZone} />
              ) : (
                <Empty
                  icon="activity"
                  title="No scored trades in this window"
                />
              )}
            </section>

            <div className="grid-2">
              <Breakdown title="By pair" rows={record?.byPair ?? []} />
              <Breakdown title="By session" rows={record?.bySession ?? []} />
            </div>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Latest settled calls</h2>
                  <p>The 25 most recent, with the levels as published</p>
                </div>
              </div>
              {record && record.recent.length === 0 ? (
                <Empty
                  icon="activity"
                  title="No settled calls in this window"
                />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Published</th>
                        <th>Pair</th>
                        <th>Call</th>
                        <th>Session</th>
                        <th className="r">Entry</th>
                        <th className="r">Target</th>
                        <th className="r">Stop</th>
                        <th>Result</th>
                        <th className="r">Pips</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(record?.recent ?? []).map((c) => (
                        <tr key={c.id}>
                          <td>
                            <span className="strong">
                              {dayDate(c.validFrom, timeZone)}
                            </span>{' '}
                            <span className="num faint">
                              {time(c.validFrom, timeZone)}
                            </span>
                          </td>
                          <td className="strong mono">{c.pairCode}</td>
                          <td>
                            <span
                              className={`tag tag-${directionTone(c.direction)}`}
                            >
                              {directionLabel(c.direction)}
                            </span>
                          </td>
                          <td>{c.session}</td>
                          <td className="r num">
                            {price(c.pairCode, (c.entryLow + c.entryHigh) / 2)}
                          </td>
                          <td className="r num">
                            {price(c.pairCode, c.targetPrice)}
                          </td>
                          <td className="r num">
                            {price(c.pairCode, c.invalidationPrice)}
                          </td>
                          <td>
                            <OutcomeTag status={c.status} />
                          </td>
                          <td
                            className={`r num ${c.movementPips === null ? 'faint' : c.movementPips > 0 ? 'up' : c.movementPips < 0 ? 'down' : ''}`}
                          >
                            {c.movementPips === null
                              ? '—'
                              : signedPips(c.movementPips)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="footnote">
                <Icon name="info" size={13} />
                Times in {tzLabel(timeZone)}. Fills at the middle of the entry
                zone; if target and stop trade in the same 15-minute candle, the
                stop counts first.
              </div>
            </section>

            <section
              className="panel panel-body"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <div>
                <h2 style={{ fontSize: 15 }}>
                  See the next call before its window opens
                </h2>
                <p className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>
                  Free account: every signal on both pairs, the weekly outlook
                  and your own trade journal.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Link to="/register" className="btn btn-primary">
                  Create a free account
                </Link>
                <a href="/#method" className="btn btn-ghost">
                  How scoring works
                </a>
              </div>
            </section>

            <p className="disclaimer">
              <Icon name="info" size={14} />
              Past results do not predict future results. FXSignal is market
              analysis for research and education, not investment advice.
            </p>
          </div>
        )}
      </main>
      <footer className="lp-footer">
        <div className="lp-container">
          <Brand />
          <span>© {new Date().getFullYear()} FXSignal</span>
        </div>
      </footer>
    </div>
  );
}
