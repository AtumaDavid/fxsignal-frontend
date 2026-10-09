import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import {
  FeedBanner,
  EventRow,
  OutcomeTag,
  SessionMap,
} from '../../components/Market';
import { SignalDrawer } from '../../components/SignalDrawer';
import { OpenTrades } from '../../components/OpenTrades';
import { GettingStarted } from '../../components/GettingStarted';
import { SignalTicket, TicketSkeleton } from '../../components/SignalTicket';
import { OutlookSummary } from './Outlook';
import { Empty } from '../../components/ui/Empty';
import { useDashboard } from '../../lib/dashboard';
import {
  dayDate,
  callLabel,
  directionTone,
  duration,
  longDate,
  signedPips,
  time,
  tzLabel,
  useNow,
} from '../../lib/format';
import { usePrefs } from '../../lib/prefs';
import { usePerformance } from '../../lib/usePerformance';
import type { DashboardData, PairCode } from '../../lib/types';

export function lastPrice(data: DashboardData | null, pair: PairCode) {
  return data?.prices.find((p) => p.pairCode === pair)?.price ?? null;
}

export default function Overview() {
  const { data, loading } = useDashboard();
  const { timeZone } = usePrefs();
  const now = useNow(30_000);
  const perf = usePerformance(365);
  const [openId, setOpenId] = useState<string | null>(null);
  const [focusTrade, setFocusTrade] = useState(false);

  const open = data?.marketStatus === 'OPEN';
  const next = data ? new Date(data.stats.nextRefresh) : null;
  const selected = data?.predictions.find((p) => p.id === openId) ?? null;
  const totals = perf.data?.totals;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">
            {longDate(new Date(now), timeZone)}
            {data && (
              <>
                <span>·</span>
                {open ? `${data.currentSession} session` : 'Weekend'}
              </>
            )}
          </div>
          <h1>
            {!data
              ? 'Overview'
              : open
                ? (data.killzoneLabel ?? 'Market open')
                : 'Markets are closed'}
          </h1>
          <p>
            {!data
              ? 'Loading the current window…'
              : open
                ? data.playbookHint
                : `Spot FX reopens ${dayDate(data.stats.nextRefresh, timeZone)} at ${time(data.stats.nextRefresh, timeZone)} ${tzLabel(timeZone)}. Use the weekend for next week's preparation.`}
          </p>
        </div>
      </div>

      <div className="stack">
        <FeedBanner />
        <GettingStarted />

        <section className="kpis" aria-label="Track record">
          <div className="kpi">
            <span
              className="label"
              data-tip="Targets ÷ (targets + stops). Only trades whose entry actually triggered count; early exits, cancellations and neutral calls are excluded."
            >
              Hit rate
            </span>
            <div className="kpi-value">
              {totals?.hitRate !== null && totals?.hitRate !== undefined ? (
                <>
                  {totals.hitRate.toFixed(1)}
                  <small>%</small>
                </>
              ) : (
                '—'
              )}
            </div>
            <span className="kpi-note">
              {totals
                ? `${totals.hits} of ${totals.scored} triggered trades`
                : 'Triggered trades only'}
            </span>
          </div>
          <div className="kpi">
            <span
              className="label"
              data-tip="Total pips won minus pips lost across settled trades, including early exits. Pips are measured from the middle of the entry zone."
            >
              Net pips
            </span>
            <div
              className={`kpi-value ${totals && totals.netPips !== 0 ? (totals.netPips > 0 ? 'up' : 'down') : ''}`}
            >
              {totals ? signedPips(totals.netPips) : '—'}
            </div>
            <span className="kpi-note">
              {perf.data
                ? `Last ${perf.data.appliedDays} days, both pairs`
                : 'Settled signals'}
            </span>
          </div>
          <div className="kpi">
            <span
              className="label"
              data-tip="Signals whose result is known. Neutral and cancelled signals are listed but never scored."
            >
              Signals settled
            </span>
            <div className="kpi-value">
              {totals ? totals.signals - totals.pending : '—'}
            </div>
            <span className="kpi-note">
              {totals
                ? `${totals.breakeven ?? 0} breakeven · ${totals.closedEarly} closed early · ${totals.cancelled} cancelled · ${totals.neutral} neutral`
                : 'In the history window'}
            </span>
          </div>
          <div className="kpi">
            <span
              className="label"
              data-tip="When the next session window opens: Asia 00:00, London 07:00, New York 12:00 UTC."
            >
              {open ? 'Next signal' : 'Market opens'}
            </span>
            <div className="kpi-value num">
              {next ? duration(next.getTime() - now) : '—'}
            </div>
            <span className="kpi-note">
              {next
                ? `${dayDate(next, timeZone)}, ${time(next, timeZone)} ${tzLabel(timeZone)}`
                : 'Asia, London and New York windows'}
            </span>
          </div>
        </section>

        <div className="section-title">
          <h2>{open || !data ? 'Current signals' : 'Week ahead'}</h2>
          <Link to={open || !data ? '/app/signals' : '/app/outlook'}>
            {open || !data ? 'Charts & reasoning' : 'Full outlook'}{' '}
            <Icon name="arrowRight" size={13} />
          </Link>
        </div>

        {loading && !data ? (
          <div className="grid-2">
            <TicketSkeleton />
            <TicketSkeleton />
          </div>
        ) : open ? (
          data && data.predictions.length > 0 ? (
            <div className="grid-2">
              {data.predictions.map((prediction) => (
                <SignalTicket
                  key={prediction.id}
                  prediction={prediction}
                  last={lastPrice(data, prediction.pairCode)}
                  onOpen={() => {
                    setFocusTrade(false);
                    setOpenId(prediction.id);
                  }}
                  onLogTrade={() => {
                    setFocusTrade(true);
                    setOpenId(prediction.id);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="panel">
              <Empty icon="signal" title="No signal for this window yet">
                Signals are built from live multi-timeframe data at the start of
                each window. If the providers are slow, the background job
                retries every 10 minutes.
              </Empty>
            </div>
          )
        ) : data && data.weeklyOutlook.length > 0 ? (
          <div className="grid-2">
            {data.weeklyOutlook.map((outlook) => (
              <OutlookSummary
                key={outlook.id}
                outlook={outlook}
                last={lastPrice(data, outlook.pairCode)}
              />
            ))}
          </div>
        ) : (
          <div className="panel">
            <Empty icon="layers" title="Next week's outlook is being prepared">
              The weekend outlook is built from monthly-to-hourly structure and
              the week-ahead calendar.
            </Empty>
          </div>
        )}

        <OpenTrades />

        <SessionMap marketOpen={open} />

        <div className="grid-split">
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Upcoming catalysts</h2>
                <p>USD, EUR and JPY releases · {tzLabel(timeZone)}</p>
              </div>
              <Link to="/app/calendar" className="btn btn-ghost btn-sm">
                Calendar <Icon name="arrowRight" size={13} />
              </Link>
            </div>
            {data && data.events.length > 0 ? (
              <div className="rows">
                {data.events.slice(0, 5).map((event) => (
                  <EventRow key={event.id} event={event} showDay />
                ))}
              </div>
            ) : (
              <Empty icon="calendar" title="Nothing scheduled">
                No upcoming releases in the calendar feed.
              </Empty>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Recent outcomes</h2>
                <p>Settled against the price path</p>
              </div>
              <Link to="/app/performance" className="btn btn-ghost btn-sm">
                History <Icon name="arrowRight" size={13} />
              </Link>
            </div>
            {data && data.history.length > 0 ? (
              <div className="rows">
                {data.history.slice(0, 5).map((p) => (
                  <div className="row" key={p.id}>
                    <span className={`tag tag-${directionTone(p.direction)}`}>
                      {callLabel(p)}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="row-title mono">{p.pairCode}</div>
                      <div className="row-sub">
                        {dayDate(p.validFrom, timeZone)} · {p.session}
                      </div>
                    </div>
                    <div
                      className="row-end"
                      style={{ display: 'grid', justifyItems: 'end', gap: 3 }}
                    >
                      <OutcomeTag status={p.outcome?.status ?? 'PENDING'} />
                      <span className="num">
                        {p.outcome?.movementPips !== null &&
                        p.outcome?.movementPips !== undefined
                          ? `${signedPips(p.outcome.movementPips)}p`
                          : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty icon="activity" title="No settled signals yet">
                Outcomes appear here once a signal window closes and is replayed
                against the candles.
              </Empty>
            )}
          </section>
        </div>

        <p className="disclaimer">
          <Icon name="info" size={14} />
          FXSignal is market context for research and education. It is not
          financial advice, and past results do not predict future ones.
        </p>
      </div>

      {selected && (
        <SignalDrawer
          prediction={selected}
          last={lastPrice(data, selected.pairCode)}
          onClose={() => setOpenId(null)}
          focus={focusTrade ? 'trade' : undefined}
        />
      )}
    </>
  );
}
