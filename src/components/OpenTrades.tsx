import { useState } from 'react';
import { Icon } from './Icon';
import { SignalDrawer } from './SignalDrawer';
import { LiveStatus, NewsWarning, PriceLadder } from './SignalTicket';
import { useDashboard } from '../lib/dashboard';
import {
  callLabel,
  dayDate,
  directionTone,
  time,
  tzLabel,
} from '../lib/format';
import { usePrefs } from '../lib/prefs';

/**
 * Earlier signals that triggered and are still running after their window
 * closed. They stay here until target or stop trades (or the Friday close).
 */
export function OpenTrades() {
  const { data } = useDashboard();
  const { timeZone } = usePrefs();
  const [openId, setOpenId] = useState<string | null>(null);
  const trades = data?.openTrades ?? [];
  if (trades.length === 0) return null;
  const selected = trades.find((t) => t.id === openId) ?? null;

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Open trades from earlier windows</h2>
          <p>
            Followed until target or stop · closed at the Friday close if still
            open
          </p>
        </div>
        <span className="tag">{trades.length} open</span>
      </div>
      <div className="open-trades">
        {trades.map((t) => (
          <div className="open-trade" key={t.id}>
            <div className="open-trade-head">
              <strong className="mono">{t.pairCode}</strong>
              <span className={`tag tag-${directionTone(t.direction)}`}>
                {callLabel(t)}
              </span>
              <span className="faint">
                {dayDate(t.validFrom, timeZone)} {time(t.validFrom, timeZone)}{' '}
                {tzLabel(timeZone)} window
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setOpenId(t.id)}
              >
                Open plan <Icon name="arrowRight" size={13} />
              </button>
            </div>
            {t.live && (
              <div className="live-flush">
                <LiveStatus prediction={t} live={t.live} />
              </div>
            )}
            {(t.news?.length ?? 0) > 0 && (
              <div className="live-flush">
                <NewsWarning prediction={t} />
              </div>
            )}
            <PriceLadder prediction={t} last={t.live?.lastPrice ?? null} />
          </div>
        ))}
      </div>
      {selected && (
        <SignalDrawer prediction={selected} onClose={() => setOpenId(null)} />
      )}
    </section>
  );
}
