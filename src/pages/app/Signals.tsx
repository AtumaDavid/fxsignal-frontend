import { Link } from 'react-router-dom';
import { FeedBanner } from '../../components/Market';
import { SignalDetail } from '../../components/SignalDrawer';
import { SignalChart } from '../../components/Charts';
import { SignalTicket, TicketSkeleton } from '../../components/SignalTicket';
import { Empty } from '../../components/ui/Empty';
import { useDashboard } from '../../lib/dashboard';
import { lastPrice } from './Overview';

export default function Signals() {
  const { data, loading } = useDashboard();
  const open = data?.marketStatus === 'OPEN';

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Signals</h1>
          <p>
            One read per pair for the current six-hour window: the bias, the
            levels, and the reasoning behind them.
          </p>
        </div>
      </div>

      <div className="stack">
        <FeedBanner />
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
                />
                <section className="panel">
                  <div className="panel-head">
                    <h2>{prediction.pairCode} · reasoning</h2>
                  </div>
                  <div className="panel-body stack" style={{ gap: 22 }}>
                    <SignalDetail prediction={prediction} />
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
    </>
  );
}
