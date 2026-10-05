import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { OutcomeTag } from '../../components/Market';
import { SignalDrawer } from '../../components/SignalDrawer';
import { Empty } from '../../components/ui/Empty';
import {
  dayDate,
  directionLabel,
  directionTone,
  price,
  signedPips,
  time,
  tzLabel,
} from '../../lib/format';
import { useJournal } from '../../lib/journal';
import { usePrefs } from '../../lib/prefs';

function pipClass(value: number | null | undefined) {
  if (value === null || value === undefined) return 'faint';
  return value > 0 ? 'up' : value < 0 ? 'down' : '';
}

export default function MyJournal() {
  const { data, error } = useJournal();
  const { timeZone } = usePrefs();
  const [openId, setOpenId] = useState<string | null>(null);
  const summary = data?.summary;
  const selected = data?.trades.find((t) => t.predictionId === openId) ?? null;
  const winRate =
    summary && summary.closed > 0
      ? ((summary.wins / summary.closed) * 100).toFixed(1)
      : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>My journal</h1>
          <p>
            The signals you actually traded, with your own entry, exit and
            notes, next to how the engine scored the same calls. Private to your
            account.
          </p>
        </div>
        <div className="page-actions">
          <Link to="/app/signals" className="btn btn-secondary">
            Current signals
          </Link>
          <Link to="/app/performance" className="btn btn-ghost">
            Signal history
          </Link>
        </div>
      </div>

      <div className="stack">
        <section className="kpis">
          <div className="kpi">
            <span className="label">Trades logged</span>
            <div className="kpi-value">{summary?.logged ?? '—'}</div>
            <span className="kpi-note">
              {summary
                ? `${summary.closed} closed · ${summary.open} open`
                : '—'}
            </span>
          </div>
          <div className="kpi">
            <span className="label">Your win rate</span>
            <div className="kpi-value">
              {winRate ? (
                <>
                  {winRate}
                  <small>%</small>
                </>
              ) : (
                '—'
              )}
            </div>
            <span className="kpi-note">
              {summary
                ? `${summary.wins} wins · ${summary.losses} losses`
                : '—'}
            </span>
          </div>
          <div className="kpi">
            <span className="label">Your net pips</span>
            <div className={`kpi-value ${pipClass(summary?.netPips)}`}>
              {summary ? signedPips(summary.netPips) : '—'}
            </div>
            <span className="kpi-note">Closed trades</span>
          </div>
          <div className="kpi">
            <span className="label">Engine, same signals</span>
            <div className={`kpi-value ${pipClass(summary?.engineNetPips)}`}>
              {summary ? signedPips(summary.engineNetPips) : '—'}
            </div>
            <span className="kpi-note">
              {summary ? `${summary.engineScored} scored by the engine` : '—'}
            </span>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Your trades</h2>
              <p>
                Select a row to edit it or see the signal's chart and reasoning
              </p>
            </div>
          </div>
          {error && !data ? (
            <Empty icon="book" title="Journal unavailable">
              {error}
            </Empty>
          ) : !data ? (
            <div className="panel-body stack">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton" style={{ height: 34 }} />
              ))}
            </div>
          ) : data.trades.length === 0 ? (
            <Empty
              icon="book"
              title="No trades logged yet"
              action={
                <Link to="/app/signals" className="btn btn-secondary">
                  Open the current signals
                </Link>
              }
            >
              Open any signal (current, or past in Signal history) and choose “I
              took this trade”. Add your entry and exit, and your results appear
              here next to the engine's.
            </Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Signal</th>
                    <th>Pair</th>
                    <th>Engine call</th>
                    <th>Your side</th>
                    <th className="r">Entry → exit</th>
                    <th className="r">Lots</th>
                    <th className="r">Your pips</th>
                    <th>Engine result</th>
                    <th className="r">Engine pips</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.trades.map((t) => {
                    const p = t.prediction;
                    const enginePips = p.outcome?.movementPips ?? null;
                    return (
                      <tr
                        key={t.id}
                        onClick={() => setOpenId(t.predictionId)}
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
                          <span
                            className={`tag tag-${directionTone(p.direction)}`}
                          >
                            {directionLabel(p.direction)}
                          </span>
                        </td>
                        <td>{t.side === 'LONG' ? 'Long' : 'Short'}</td>
                        <td className="r num">
                          {price(p.pairCode, t.entryPrice)} →{' '}
                          {t.exitPrice !== null
                            ? price(p.pairCode, t.exitPrice)
                            : 'open'}
                        </td>
                        <td className="r num">{t.lots ?? '—'}</td>
                        <td className={`r num ${pipClass(t.pips)}`}>
                          {t.pips === null ? '—' : signedPips(t.pips)}
                        </td>
                        <td>
                          <OutcomeTag status={p.outcome?.status ?? 'PENDING'} />
                        </td>
                        <td className={`r num ${pipClass(enginePips)}`}>
                          {enginePips === null ? '—' : signedPips(enginePips)}
                        </td>
                        <td
                          style={{
                            maxWidth: 260,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {t.notes ?? <span className="faint">—</span>}
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
            Your pips are measured from your own entry to exit. Engine pips are
            from the middle of the entry zone. Times in {tzLabel(timeZone)}.
          </div>
        </section>
      </div>

      {selected && (
        <SignalDrawer
          prediction={selected.prediction}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  );
}
