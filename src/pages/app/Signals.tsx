import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SignalDrawer } from '../../components/SignalDrawer';
import { FeedBanner } from '../../components/Market';
import { OpenTrades } from '../../components/OpenTrades';
import { SignalDetail } from '../../components/SignalDrawer';
import { SignalChart } from '../../components/Charts';
import { SignalTicket, TicketSkeleton } from '../../components/SignalTicket';
import { Empty } from '../../components/ui/Empty';
import { useDashboard } from '../../lib/dashboard';
import { lastPrice } from './Overview';

export default function Signals() {
  const { data, loading } = useDashboard();
  // "Log trade" opens the plan straight at My trade.
  const [logId, setLogId] = useState<string | null>(null);
  const logging = data?.predictions.find((p) => p.id === logId) ?? null;
  const open = data?.marketStatus === 'OPEN';

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
        ) : data && data.predictions.length > 0 ? (
          data.predictions.map((prediction) => (
            <div className="stack" key={prediction.id}>
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>{prediction.pairCode} · price action</h2>
                    <p>
                      The published levels over live candles. The arrow marks
                      when this window's call was made.
                    </p>
                  </div>
                </div>
                <SignalChart prediction={prediction} />
              </section>
              <div className="grid-2" style={{ alignItems: 'start' }}>
                <SignalTicket
                  prediction={prediction}
                  last={lastPrice(data, prediction.pairCode)}
                  onLogTrade={() => setLogId(prediction.id)}
                />
                <section className="panel">
                  <div className="panel-head">
                    <h2>{prediction.pairCode} · plan &amp; reasoning</h2>
                  </div>
                  <div className="panel-body stack" style={{ gap: 22 }}>
                    <SignalDetail prediction={prediction} summary={false} />
                  </div>
                </section>
              </div>
            </div>
          ))
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
