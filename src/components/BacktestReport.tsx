import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { PipsChart } from './PipsChart';
import { Empty } from './ui/Empty';
import { getPublicBacktest } from '../lib/api';
import { dayDate, price, signedPips, time, tzLabel } from '../lib/format';
import { usePrefs } from '../lib/prefs';
import type { BacktestGroup, BacktestReport as Report } from '../lib/types';

function signedR(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(2)}R`;
}

function tone(value: number | null | undefined) {
  if (value === null || value === undefined) return 'faint';
  return value > 0 ? 'up' : value < 0 ? 'down' : '';
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  HIT: { label: 'Target', cls: 'tag-up' },
  MISSED: { label: 'Stopped', cls: 'tag-down' },
  CLOSED_EARLY: { label: 'Closed early', cls: 'tag-flat' },
  EXPIRED: { label: 'Expired', cls: '' },
  CANCELLED: { label: 'Cancelled', cls: '' },
  OPEN: { label: 'Open', cls: 'tag-solid' },
};

function GroupRows({ title, rows }: { title: string; rows: BacktestGroup[] }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>{title.replace('By ', '')}</th>
              <th className="r">Trades</th>
              <th className="r">W / L</th>
              <th className="r">Net R</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.key}>
                <td className="strong">{g.key}</td>
                <td className="r num">{g.trades}</td>
                <td className="r num">
                  {g.wins} / {g.losses}
                </td>
                <td className={`r num ${tone(g.netR)}`}>{signedR(g.netR)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * The published backtest: the live rules replayed over past months, with
 * every simulated trade listed so the headline can be checked.
 */
export function BacktestReport() {
  const { timeZone } = usePrefs();
  const [data, setData] = useState<Report | null>(null);
  const [missing, setMissing] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getPublicBacktest(controller.signal)
      .then(setData)
      .catch(() => {
        if (!controller.signal.aborted) setMissing(true);
      });
    return () => controller.abort();
  }, []);

  if (missing) return null;
  if (!data) return <div className="skeleton" style={{ height: 240 }} />;

  const s = data.summary;
  const trades = [...data.trades]
    .filter((t) => t.filled || t.status === 'CANCELLED')
    .reverse();
  const shown = showAll ? trades : trades.slice(0, 15);
  const maxMonth = Math.max(0.5, ...s.byMonth.map((m) => Math.abs(m.netR)));
  const range = `${dayDate(s.from, 'utc')} – ${dayDate(s.to, 'utc')}`;

  return (
    <div className="stack" id="backtest">
      <div className="bt-head">
        <span className="eyebrow">Backtest</span>
        <h2>
          <span className={tone(s.netR)}>{signedR(s.netR)}</span> over{' '}
          {data.months} month{data.months === 1 ? '' : 's'} · {s.trades} trades
        </h2>
        <p>
          The same rules that publish today's signals, replayed over {range}: a
          read at every session window from the candles closed by then, the same
          entry zone, stop and three targets, scored exactly like the live track
          record. Every trade is listed below.
        </p>
      </div>

      <section className="kpis">
        <div className="kpi">
          <span
            className="label"
            data-tip="Sum of every trade's result in R (1R = the distance to the stop)."
          >
            Net result
          </span>
          <div className={`kpi-value ${tone(s.netR)}`}>{signedR(s.netR)}</div>
          <span className="kpi-note">
            <span className={tone(s.netPips)}>{signedPips(s.netPips)}p</span> ·{' '}
            {signedR(s.avgR)} per trade
          </span>
        </div>
        <div className="kpi">
          <span
            className="label"
            data-tip="Targets ÷ (targets + stops). Early and time exits are counted in R, not here."
          >
            Win rate
          </span>
          <div className="kpi-value">
            {s.winRate === null ? (
              '—'
            ) : (
              <>
                {s.winRate.toFixed(0)}
                <small>%</small>
              </>
            )}
          </div>
          <span className="kpi-note">
            {s.wins} targets · {s.losses} stops · {s.earlyExits + s.timeExits}{' '}
            other exits
          </span>
        </div>
        <div className="kpi">
          <span
            className="label"
            data-tip="Total won R ÷ total lost R. Above 1 means the wins outweigh the losses."
          >
            Profit factor
          </span>
          <div className="kpi-value">{s.profitFactor?.toFixed(2) ?? '—'}</div>
          <span className="kpi-note">{s.standAsides} windows stood aside</span>
        </div>
        <div className="kpi">
          <span
            className="label"
            data-tip="Largest fall from a high point of the cumulative result, in R."
          >
            Max drawdown
          </span>
          <div className="kpi-value down">−{s.maxDrawdownR.toFixed(2)}R</div>
          <span className="kpi-note">
            Longest losing run: {s.longestLosingStreak}
          </span>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Cumulative result</h2>
            <p>In R, one step per closed trade</p>
          </div>
        </div>
        {s.curve.length > 0 ? (
          <PipsChart
            curve={s.curve.map((p) => ({
              at: p.at,
              pips: p.r,
              pairCode: '' as never,
            }))}
            timeZone={timeZone}
            unit="R"
          />
        ) : (
          <Empty icon="activity" title="No closed trades" />
        )}
        {s.byMonth.length > 1 && (
          <div className="bt-months">
            {s.byMonth.map((m) => (
              <div key={m.key} className="bt-month">
                <div className="bt-month-bar" aria-hidden="true">
                  <span className="recap-day-mid" />
                  <span
                    className={`recap-day-fill ${m.netR >= 0 ? 'up' : 'down'}`}
                    style={
                      m.netR >= 0
                        ? {
                            bottom: '50%',
                            height: `${(m.netR / maxMonth) * 50}%`,
                          }
                        : {
                            top: '50%',
                            height: `${(Math.abs(m.netR) / maxMonth) * 50}%`,
                          }
                    }
                  />
                </div>
                <strong className={`num ${tone(m.netR)}`}>
                  {signedR(m.netR)}
                </strong>
                <span>
                  {new Intl.DateTimeFormat('en-GB', {
                    month: 'short',
                    timeZone: 'UTC',
                  }).format(new Date(`${m.key}-15T00:00:00Z`))}{' '}
                  · {m.trades}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid-2">
        <GroupRows title="By pair" rows={s.byPair} />
        <GroupRows title="By session" rows={s.bySession} />
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Every simulated trade</h2>
            <p>
              Newest first · {trades.length} trades (stand-asides and unfilled
              windows not listed)
            </p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Published</th>
                <th>Pair</th>
                <th>Call</th>
                <th className="r">Entry</th>
                <th className="r">Stop</th>
                <th className="r">TP1 / TP2 / TP3</th>
                <th>Result</th>
                <th className="r">Pips</th>
                <th className="r">R</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((t) => {
                const meta = STATUS_LABEL[t.status] ?? {
                  label: t.status,
                  cls: '',
                };
                return (
                  <tr key={`${t.pairCode}-${t.publishedAt}`} title={t.note}>
                    <td>
                      <span className="strong">
                        {dayDate(t.publishedAt, timeZone)}
                      </span>{' '}
                      <span className="num faint">
                        {time(t.publishedAt, timeZone)}
                      </span>
                      <div className="faint" style={{ fontSize: 11.5 }}>
                        {t.session}
                      </div>
                    </td>
                    <td className="strong mono">{t.pairCode}</td>
                    <td>
                      <span
                        className={`tag tag-${t.direction === 'LONG' ? 'up' : 'down'}`}
                      >
                        {t.direction === 'LONG' ? 'Long' : 'Short'}
                      </span>
                    </td>
                    <td className="r num">
                      {price(t.pairCode, (t.entryLow + t.entryHigh) / 2)}
                    </td>
                    <td className="r num">{price(t.pairCode, t.stop)}</td>
                    <td className="r num faint">
                      {price(t.pairCode, t.tp1)} / {price(t.pairCode, t.tp2)} /{' '}
                      {price(t.pairCode, t.tp3)}
                    </td>
                    <td>
                      <span className={`tag ${meta.cls}`}>
                        {meta.label}
                        {t.tpHits > 0 && t.status === 'HIT'
                          ? ` · ${t.tpHits}/3`
                          : ''}
                      </span>
                    </td>
                    <td className={`r num ${tone(t.pips)}`}>
                      {t.pips === null ? '—' : signedPips(t.pips)}
                    </td>
                    <td className={`r num ${tone(t.r)}`}>{signedR(t.r)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {trades.length > 15 && (
          <div className="panel-body" style={{ paddingTop: 12 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? 'Show fewer' : `Show all ${trades.length} trades`}
            </button>
          </div>
        )}
        <div className="footnote">
          <Icon name="info" size={13} />
          Simulated, not live: rules only (no model review); one trade per pair
          per window; a window is skipped while the pair's previous trade is
          open ({s.skippedOpen} windows); news only where the calendar was
          stored. No spread or commission. Times in {tzLabel(timeZone)}.
        </div>
      </section>
    </div>
  );
}
