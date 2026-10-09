import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { OutcomeTag } from '../../components/Market';
import { SignalDrawer } from '../../components/SignalDrawer';
import { Empty } from '../../components/ui/Empty';
import {
  dayDate,
  callLabel,
  directionTone,
  price,
  signedPips,
  time,
  tzLabel,
} from '../../lib/format';
import { useJournal } from '../../lib/journal';
import { usePrefs } from '../../lib/prefs';
import type { JournalBreakdown } from '../../lib/types';

function pipClass(value: number | null | undefined) {
  if (value === null || value === undefined) return 'faint';
  return value > 0 ? 'up' : value < 0 ? 'down' : '';
}

/**
 * One group of the user's closed trades (a pair or a session): net pips as a
 * bar that grows left (losing) or right (winning) from the middle, scaled to
 * the biggest group so they compare at a glance.
 */
function EdgeTable({
  title,
  hint,
  rows,
}: {
  title: string;
  hint: string;
  rows: JournalBreakdown[];
}) {
  const scale = Math.max(1, ...rows.map((r) => Math.abs(r.netPips)));
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2 data-tip={hint}>{title}</h2>
        </div>
      </div>
      <div className="edge-list">
        {rows.map((row) => {
          const width = (Math.abs(row.netPips) / scale) * 50;
          return (
            <div className="edge-row" key={row.key}>
              <div className="edge-name">
                <strong>{row.key}</strong>
                <span className="faint num">
                  {row.trades} {row.trades === 1 ? 'trade' : 'trades'} ·{' '}
                  {row.winRate === null
                    ? '—'
                    : `${row.winRate.toFixed(0)}% won`}
                </span>
              </div>
              <div className="edge-bar" aria-hidden="true">
                <span className="edge-bar-mid" />
                <span
                  className={`edge-bar-fill ${row.netPips >= 0 ? 'up' : 'down'}`}
                  style={
                    row.netPips >= 0
                      ? { left: '50%', width: `${width}%` }
                      : { right: '50%', width: `${width}%` }
                  }
                />
              </div>
              <div className="edge-nums">
                <strong className={`num ${pipClass(row.netPips)}`}>
                  {signedPips(row.netPips)}
                </strong>
                <span
                  className="faint num"
                  data-tip="Average pips per closed trade."
                >
                  {signedPips(row.avgPips)} avg
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** "London is your best session" style read-out, once there is enough data. */
function edgeInsight(
  bySession: JournalBreakdown[],
  byPair: JournalBreakdown[]
) {
  const ranked = (rows: JournalBreakdown[]) =>
    rows.filter((r) => r.trades >= 2);
  const sessions = ranked(bySession);
  const pairs = ranked(byPair);
  const parts: string[] = [];
  if (sessions.length >= 2) {
    const best = sessions[0];
    const worst = sessions[sessions.length - 1];
    parts.push(
      `Your best session is ${best.key} (${signedPips(best.netPips)} over ${best.trades} trades)` +
        (worst.netPips < 0
          ? `; ${worst.key} is costing you (${signedPips(worst.netPips)}).`
          : '.')
    );
  }
  if (pairs.length >= 2 && pairs[0].netPips !== pairs[1].netPips) {
    parts.push(
      `${pairs[0].key} has worked better for you than ${pairs[pairs.length - 1].key}.`
    );
  }
  return parts.join(' ');
}

export default function MyJournal() {
  const { data, error } = useJournal();
  const { timeZone } = usePrefs();
  const [openId, setOpenId] = useState<string | null>(null);
  const summary = data?.summary;
  // How the engine's own trades ended on the signals you took.
  const engineCount = (status: string) =>
    (data?.trades ?? []).filter(
      (t) => (t.prediction.outcome?.status ?? 'PENDING') === status
    ).length;
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
            <span className="label" data-tip="Trades you saved with Log trade.">
              Trades logged
            </span>
            <div className="kpi-value">{summary?.logged ?? '—'}</div>
            <span className="kpi-note">
              {summary
                ? `${summary.closed} closed · ${summary.open} open`
                : '—'}
            </span>
          </div>
          <div className="kpi">
            <span
              className="label"
              data-tip="Your closed trades that made pips ÷ all your closed trades."
            >
              Your win rate
            </span>
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
            <span
              className="label"
              data-tip="Your pips from your own entries and exits, on closed trades."
            >
              Your net pips
            </span>
            <div className={`kpi-value ${pipClass(summary?.netPips)}`}>
              {summary ? signedPips(summary.netPips) : '—'}
            </div>
            <span className="kpi-note">Closed trades</span>
          </div>
          <div className="kpi">
            <span
              className="label"
              data-tip="The engine's result on exactly the signals you traded, for comparison."
            >
              Engine, same signals
            </span>
            <div className={`kpi-value ${pipClass(summary?.engineNetPips)}`}>
              {summary ? signedPips(summary.engineNetPips) : '—'}
            </div>
            <span className="kpi-note">
              {data
                ? `${engineCount('HIT')} targets · ${engineCount('MISSED')} stops · ${engineCount('BREAKEVEN')} breakeven · ${engineCount('CLOSED_EARLY')} closed early · ${engineCount('PENDING')} open`
                : '—'}
            </span>
          </div>
        </section>

        {data && data.summary.closed > 0 && (
          <>
            <div className="edge-head">
              <h2>Where you trade best</h2>
              <p>
                {edgeInsight(data.bySession ?? [], data.byPair ?? []) ||
                  'Closed trades grouped by session and pair. A clearer picture builds after a few trades in each.'}
              </p>
            </div>
            <div className="grid-2">
              <EdgeTable
                title="By session"
                hint="The session the signal was published in (Asia, London, New York)."
                rows={data.bySession ?? []}
              />
              <EdgeTable
                title="By pair"
                hint="Your closed trades on each pair."
                rows={data.byPair ?? []}
              />
            </div>
          </>
        )}

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
                            {callLabel(p)}
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
