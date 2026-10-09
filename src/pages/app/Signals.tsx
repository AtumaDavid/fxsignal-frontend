import { useState, type KeyboardEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SignalDrawer } from '../../components/SignalDrawer';
import { FeedBanner } from '../../components/Market';
import { OpenTrades } from '../../components/OpenTrades';
import { SignalDetail } from '../../components/SignalDrawer';
import { SignalChart } from '../../components/Charts';
import { SignalTicket, TicketSkeleton } from '../../components/SignalTicket';
import { Empty } from '../../components/ui/Empty';
import { useDashboard } from '../../lib/dashboard';
import { callLabel, directionTone, price, signedPips } from '../../lib/format';
import { nextStep } from '../../lib/nextStep';
import type { Prediction } from '../../lib/types';
import { lastPrice } from './Overview';

/** Compact status for a pair tab: live pips once filled, else the next step. */
function tabStatus(p: Prediction) {
  const live = p.live;
  if (live?.state === 'running' && live.pips !== null)
    return {
      text: `Running ${signedPips(live.pips)}p`,
      tone: live.pips > 0 ? 'up' : live.pips < 0 ? 'down' : '',
    };
  return { text: nextStep(p).title, tone: '' };
}

export default function Signals() {
  const { data, loading } = useDashboard();
  // "Log trade" opens the plan straight at My trade.
  const [logId, setLogId] = useState<string | null>(null);
  const logging = data?.predictions.find((p) => p.id === logId) ?? null;
  const open = data?.marketStatus === 'OPEN';
  // One pair on screen at a time; the tab strip summarises all of them.
  const [params, setParams] = useSearchParams();
  const predictions = data?.predictions ?? [];
  const selected =
    predictions.find((p) => p.pairCode === params.get('pair')) ??
    predictions[0] ??
    null;
  const select = (p: Prediction) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('pair', p.pairCode);
        return next;
      },
      { replace: true }
    );
  const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const index = predictions.findIndex((p) => p.id === selected?.id);
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const next =
      predictions[(index + step + predictions.length) % predictions.length];
    if (!next) return;
    select(next);
    document.getElementById(`pair-tab-${next.id}`)?.focus();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Signals</h1>
          <p>
            One read per pair for the current session window: the bias, the
            levels, and the reasoning behind them.
          </p>
        </div>
      </div>

      <div className="stack">
        <FeedBanner />
        <OpenTrades />
        {loading && !data ? (
          <div className="grid-2">
            <TicketSkeleton />
            <TicketSkeleton />
          </div>
        ) : !open ? (
          <div className="panel">
            <Empty
              icon="layers"
              title="No intraday signals over the weekend"
              action={
                <Link to="/app/outlook" className="btn btn-secondary">
                  Open the week-ahead outlook
                </Link>
              }
            >
              Spot FX is closed from Friday 22:00 to Sunday 22:00 UTC. The first
              window of the week is published at the Sunday open.
            </Empty>
          </div>
        ) : data && selected ? (
          <>
            <div
              className="pair-tabs"
              role="tablist"
              aria-label="Pairs"
              onKeyDown={onTabKey}
            >
              {predictions.map((p) => {
                const status = tabStatus(p);
                const active = p.id === selected.id;
                const last = lastPrice(data, p.pairCode);
                return (
                  <button
                    key={p.id}
                    id={`pair-tab-${p.id}`}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-controls="pair-panel"
                    tabIndex={active ? 0 : -1}
                    className={`pair-tab${active ? ' active' : ''}`}
                    onClick={() => select(p)}
                  >
                    <span className="pair-tab-top">
                      <strong>{p.pairCode}</strong>
                      <span className={`tag tag-${directionTone(p.direction)}`}>
                        {callLabel(p)}
                      </span>
                    </span>
                    <span className="pair-tab-bottom">
                      <span className={`pair-tab-status ${status.tone}`}>
                        {status.text}
                      </span>
                      {last !== null && (
                        <span className="pair-tab-price num">
                          {price(p.pairCode, last)}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            <div
              className="signal-view"
              id="pair-panel"
              role="tabpanel"
              aria-labelledby={`pair-tab-${selected.id}`}
            >
              <div className="signal-side">
                <SignalTicket
                  prediction={selected}
                  last={lastPrice(data, selected.pairCode)}
                  onLogTrade={() => setLogId(selected.id)}
                />
              </div>
              <div className="signal-main stack">
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>{selected.pairCode} · chart</h2>
                      <p>
                        The published levels over live candles. The arrow marks
                        when this call was made.
                      </p>
                    </div>
                  </div>
                  <SignalChart
                    key={selected.id}
                    prediction={selected}
                    height={400}
                  />
                </section>
                <section className="panel">
                  <div className="panel-head">
                    <h2>Plan &amp; reasoning</h2>
                  </div>
                  <div className="panel-body stack" style={{ gap: 22 }}>
                    <SignalDetail
                      key={selected.id}
                      prediction={selected}
                      summary={false}
                    />
                  </div>
                </section>
              </div>
            </div>
          </>
        ) : (
          <div className="panel">
            <Empty icon="signal" title="No signal for this window yet">
              Nothing is published until real market data is available for the
              window.
            </Empty>
          </div>
        )}
      </div>
      {logging && (
        <SignalDrawer
          prediction={logging}
          last={lastPrice(data, logging.pairCode)}
          onClose={() => setLogId(null)}
          focus="trade"
        />
      )}
    </>
  );
}
