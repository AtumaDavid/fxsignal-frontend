import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { OutcomeTag } from '../../components/Market';
import { SignalDrawer } from '../../components/SignalDrawer';
import { Empty } from '../../components/ui/Empty';
import { Select, type SelectOption } from '../../components/ui/Select';
import { getRecap } from '../../lib/api';
import {
  callLabel,
  dayDate,
  directionTone,
  signedPips,
  time,
  tzLabel,
} from '../../lib/format';
import { usePrefs } from '../../lib/prefs';
import type { Prediction, RecapGroup, WeeklyRecap } from '../../lib/types';

function tone(value: number | null | undefined) {
  if (value === null || value === undefined) return 'faint';
  return value > 0 ? 'up' : value < 0 ? 'down' : '';
}

function signedR(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(2)}R`;
}

/** Result of one trade in R, from its pips and stop distance. */
function tradeR(p: Prediction) {
  const pips = p.outcome?.movementPips;
  if (pips === null || pips === undefined || !p.stopPips) return null;
  return pips / p.stopPips;
}

function weekLabel(monday: string) {
  const start = new Date(`${monday}T00:00:00Z`);
  const end = new Date(start.getTime() + 4 * 86_400_000);
  const fmt = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

function GroupTable({ title, rows }: { title: string; rows: RecapGroup[] }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
      </div>
      {rows.length === 0 ? (
        <Empty icon="activity" title="No closed trades" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{title.replace('By ', '')}</th>
                <th className="r">Trades</th>
                <th className="r">W / L</th>
                <th className="r">Pips</th>
                <th className="r">R</th>
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
                  <td className={`r num ${tone(g.netPips)}`}>
                    {signedPips(g.netPips)}
                  </td>
                  <td className={`r num ${tone(g.netR)}`}>{signedR(g.netR)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function Recap() {
  const { timeZone } = usePrefs();
  const [week, setWeek] = useState('');
  const [data, setData] = useState<WeeklyRecap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    getRecap(week || undefined, controller.signal)
      .then((recap) => {
        setData(recap);
        if (!week) setWeek(recap.weekStart.slice(0, 10));
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Recap unavailable.');
      });
    return () => controller.abort();
  }, [week]);

  const options: SelectOption<string>[] = (data?.weeks ?? []).map((w, i) => ({
    value: w,
    label: weekLabel(w),
    hint: i === 0 ? 'This week' : i === 1 ? 'Last week' : undefined,
  }));
  const e = data?.engine;
  const maxDay = Math.max(
    1,
    ...(data?.days ?? []).map((d) => Math.abs(d.netPips))
  );
  const selected = data?.trades.find((t) => t.id === openId) ?? null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Weekly recap</h1>
          <p>
            The week in one page: every signal and how it ended, the best and
            worst trades, and how your own trades went.
          </p>
        </div>
        <div className="page-actions">
          {options.length > 0 && (
            <Select
              label="Week"
              value={week}
              onChange={setWeek}
              options={options}
              active={false}
              minWidth={200}
            />
          )}
        </div>
      </div>

      {error && !data ? (
        <div className="panel">
          <Empty icon="activity" title="Recap unavailable">
            {error}
          </Empty>
        </div>
      ) : !data || !e ? (
        <div className="stack">
          <div className="skeleton" style={{ height: 110 }} />
          <div className="skeleton" style={{ height: 220 }} />
        </div>
      ) : (
        <div className="stack">
          <section className="kpis">
            <div className="kpi">
              <span
                className="label"
                data-tip="Sum of every closed trade's result in R (1R = the distance to the stop)."
              >
                Net result
              </span>
              <div className={`kpi-value ${tone(e.netR)}`}>
                {signedR(e.netR)}
              </div>
              <span className="kpi-note">
                <span className={tone(e.netPips)}>
                  {signedPips(e.netPips)}p
                </span>{' '}
                on closed trades
              </span>
            </div>
            <div className="kpi">
              <span
                className="label"
                data-tip="Targets ÷ (targets + stops). Breakevens and early exits are left out."
              >
                Win rate
              </span>
              <div className="kpi-value">
                {e.winRate === null ? (
                  '—'
                ) : (
                  <>
                    {e.winRate.toFixed(0)}
                    <small>%</small>
                  </>
                )}
              </div>
              <span className="kpi-note">
                {e.wins} wins · {e.losses} losses
              </span>
            </div>
            <div className="kpi">
              <span
                className="label"
                data-tip="Long or short calls published this week."
              >
                Signals
              </span>
              <div className="kpi-value">{e.signals}</div>
              <span className="kpi-note">
                {e.closed} closed · {e.open} open · {e.notTriggered} not
                triggered · {e.cancelled} cancelled
              </span>
            </div>
            <div className="kpi">
              <span
                className="label"
                data-tip="Your journal trades on this week's signals."
              >
                Your week
              </span>
              <div className={`kpi-value ${tone(data.you.netPips)}`}>
                {data.you.closed > 0 ? `${signedPips(data.you.netPips)}p` : '—'}
              </div>
              <span className="kpi-note">
                {data.you.logged > 0 ? (
                  `${data.you.wins} wins · ${data.you.losses} losses · ${data.you.logged - data.you.closed} open`
                ) : (
                  <Link to="/app/journal">No trades logged</Link>
                )}
              </span>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Day by day</h2>
                <p>Net pips of the trades published each day</p>
              </div>
              {(e.best || e.worst) && (
                <div className="recap-extremes">
                  {e.best && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setOpenId(e.best!.id)}
                    >
                      Best: {e.best.pairCode}{' '}
                      <span className="up num">{signedPips(e.best.pips)}p</span>
                    </button>
                  )}
                  {e.worst && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setOpenId(e.worst!.id)}
                    >
                      Worst: {e.worst.pairCode}{' '}
                      <span className="down num">
                        {signedPips(e.worst.pips)}p
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="recap-days">
              {data.days.map((d) => {
                const h = (Math.abs(d.netPips) / maxDay) * 50;
                return (
                  <div className="recap-day" key={d.date}>
                    <div className="recap-day-bar" aria-hidden="true">
                      <span className="recap-day-mid" />
                      {d.trades > 0 && (
                        <span
                          className={`recap-day-fill ${d.netPips >= 0 ? 'up' : 'down'}`}
                          style={
                            d.netPips >= 0
                              ? { bottom: '50%', height: `${h}%` }
                              : { top: '50%', height: `${h}%` }
                          }
                        />
                      )}
                    </div>
                    <strong
                      className={`num ${d.trades ? tone(d.netPips) : 'faint'}`}
                    >
                      {d.trades ? `${signedPips(d.netPips)}p` : '—'}
                    </strong>
                    <span>
                      {new Intl.DateTimeFormat('en-GB', {
                        weekday: 'short',
                        timeZone: 'UTC',
                      }).format(new Date(`${d.date}T12:00:00Z`))}
                      {d.trades > 0 ? ` · ${d.trades}` : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="grid-2">
            <GroupTable title="By pair" rows={data.byPair} />
            <GroupTable title="By session" rows={data.bySession} />
          </div>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Every signal this week</h2>
                <p>Select one to see its chart, plan and how it played out</p>
              </div>
            </div>
            {data.trades.length === 0 ? (
              <Empty icon="signal" title="No signals this week" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Published</th>
                      <th>Pair</th>
                      <th>Call</th>
                      <th>Session</th>
                      <th>Result</th>
                      <th className="r">Pips</th>
                      <th className="r">R</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.trades.map((p) => {
                      const r = tradeR(p);
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
                            <span
                              className={`tag tag-${directionTone(p.direction)}`}
                            >
                              {callLabel(p)}
                            </span>
                          </td>
                          <td>{p.session}</td>
                          <td>
                            <OutcomeTag
                              status={p.outcome?.status ?? 'PENDING'}
                            />
                          </td>
                          <td
                            className={`r num ${tone(p.outcome?.movementPips)}`}
                          >
                            {p.outcome?.movementPips === null ||
                            p.outcome?.movementPips === undefined
                              ? '—'
                              : signedPips(p.outcome.movementPips)}
                          </td>
                          <td className={`r num ${tone(r)}`}>{signedR(r)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="footnote">
              <Icon name="info" size={13} />
              Pips and R are for the whole position from the middle of the entry
              zone. Times in {tzLabel(timeZone)}.
            </div>
          </section>

          <div className="recap-next">
            <div>
              <strong>Ready for next week?</strong>
              <span>
                The week-ahead outlook is published over the weekend: bias, key
                levels and scenarios for both pairs.
              </span>
            </div>
            <Link to="/app/outlook" className="btn btn-secondary btn-sm">
              Week ahead <Icon name="arrowRight" size={13} />
            </Link>
          </div>
        </div>
      )}

      {selected && (
        <SignalDrawer prediction={selected} onClose={() => setOpenId(null)} />
      )}
    </>
  );
}
