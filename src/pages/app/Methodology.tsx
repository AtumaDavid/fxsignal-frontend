import {
  hourRange,
  localDiffersFromUtc,
  tzLabel,
  utcHourAs,
} from '../../lib/format';

const WINDOWS: [string, number, number, string][] = [
  ['Asia range', 0, 7, 'Mean reversion; mark the high and low for London'],
  ['London killzone', 7, 10, 'Break of the Asia range'],
  ['Late London', 10, 12, 'Continuation, or patience into New York'],
  ['New York killzone', 12, 15, 'Morning momentum usually sets the day'],
  ['New York afternoon', 15, 22, 'Manage open risk; clean retests only'],
];

export default function Methodology() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Methodology</h1>
          <p>
            How a signal is built, published and scored. Nothing here is
            simulated or back-filled.
          </p>
        </div>
      </div>

      <article className="doc">
        <section>
          <h2>1. Context, execution, confirmation</h2>
          <p>
            Each timeframe has one job. For each pair the engine computes EMA
            20/50/200, RSI 14, ATR 14 and swing structure on four timeframes and
            scores each from −100 to +100.
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Timeframe</th>
                  <th>Role</th>
                  <th>What it decides</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Daily', 'Context (55%)', 'The direction, together with H4'],
                  [
                    'H4',
                    'Context (45%)',
                    'The direction, together with the daily',
                  ],
                  [
                    'H1',
                    'Execution',
                    'Whether to trade at all, the entry zone and the stop',
                  ],
                  [
                    'M15',
                    'Confirmation',
                    'Timing: raises or lowers confidence, never sets direction',
                  ],
                ].map(([tf, role, decides]) => (
                  <tr key={tf}>
                    <td className="strong">{tf}</td>
                    <td>{role}</td>
                    <td>{decides}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul>
            <li>
              A weighted daily + H4 score of +15 or more is{' '}
              <strong>Long</strong>, −15 or less <strong>Short</strong>,
              anything between <strong>Neutral</strong> (no trade).
            </li>
            <li>
              If H1 points against that context, there is no execution that
              window: the call is published as Neutral with the reason.
            </li>
            <li>
              Confidence (15–92%) rises when daily and H4 agree, when H1 is
              aligned and when M15 already confirms. It falls when M15 disagrees
              and when a high-impact release lands inside the window (−10 per
              high, −3 per medium, capped at −20).
            </li>
            <li>
              Monthly and weekly charts are not used for intraday calls; they
              still drive the weekend outlook.
            </li>
          </ul>
        </section>

        <section>
          <h2>2. Levels: H1 execution, at least 1:2</h2>
          <ul>
            <li>
              The entry zone is centred on the current price and sized from H1
              ATR (8–28 pips wide). Execute inside it on H1, after an M15 candle
              closes in the trade direction.
            </li>
            <li>
              The invalidation sits 3 pips beyond the last ten H1 bars of
              structure, and at least 12 pips past the zone.
            </li>
            <li>
              The target is at least <strong>2× the risk</strong>, both measured
              from the middle of the zone, and is rounded outward so rounding
              can never cost reward.
            </li>
            <li>
              Three targets, a third of the position at each:{' '}
              <strong>TP1</strong> at 1R, <strong>TP2</strong> at the 2R target
              and <strong>TP3</strong> one more R beyond it (3R). At TP1 the
              stop moves to the entry, so the trade can no longer lose; at TP2
              it moves to TP1, locking in profit. If all three trade, the whole
              position makes 2R.
            </li>
            <li>
              If the structural stop would be wider than 60 pips, 1:2 cannot fit
              inside one window, so the engine stands aside instead of
              publishing a worse ratio.
            </li>
            <li>
              When the model review is enabled, a language model may keep the
              direction or downgrade it to Neutral, but never flip it or trade a
              window the engine stood aside on. Its levels go through the same
              limits; a target closer than 2R is pushed out to 2R, and if that
              does not fit, the engine's levels are used.
            </li>
          </ul>
        </section>

        <section>
          <h2>3. Cadence</h2>
          <p>
            Signals follow the trading sessions, not a fixed clock. Each pair
            gets one call per window: <strong>Asia</strong> 00:00–07:00 UTC (a
            lighter read: only fully aligned setups at 70%+ confidence),{' '}
            <strong>London</strong> 07:00–12:00 and <strong>New York</strong>{' '}
            12:00–17:00. Nothing new is published from 17:00 to midnight, when
            liquidity thins out, or over the weekend, when the engine publishes
            a week-ahead outlook instead.
          </p>
          <p>
            <strong>Early re-checks.</strong> When a trade reaches its target or
            stop during London or New York, the pair is read again at the next
            H1 close instead of waiting for the next window. After a stop, H1
            must clearly agree with the daily/H4 context again (no revenge
            entries). At most two trades per pair per window, one re-check per
            H1 candle, and none in the last 45 minutes of a window.
          </p>
        </section>

        <section>
          <h2>4. The H1 checkpoint</h2>
          <p>
            H1 is the execution timeframe, so every closed H1 candle is a
            checkpoint for each open signal and trade. No model calls are
            involved; it uses the same indicators as the engine.
          </p>
          <ul>
            <li>
              <strong>Before entry — cancel.</strong> If the zone has not filled
              and H1 turns against the context, the daily/H4 context flips, or
              price closes beyond the invalidation level, the signal is{' '}
              <strong>cancelled</strong>. It was never a trade and is not
              scored. The pair is then re-read at a later H1 close, and a new
              entry needs H1 to clearly agree with the context again.
            </li>
            <li>
              <strong>After entry — exit early, only on two signs.</strong> The
              trade is closed early only when, on the same H1 close, price is
              back through the far side of the entry zone <em>and</em> H1 or H4
              now points against the trade. Either sign alone is ignored; that
              is what the stop is for.
            </li>
            <li>
              Early exits are recorded at the H1 close price as{' '}
              <strong>Closed early</strong>: counted in net pips and the pips
              curve, but kept out of the target/stop hit rate, so you can judge
              whether early exits help.
            </li>
          </ul>
        </section>

        <section>
          <h2>5. Scoring</h2>
          <p>
            After a window closes, its signal is replayed against M15 candles
            (H1 if M15 is unavailable):
          </p>
          <ol>
            <li>
              No position exists until price trades into the entry zone during
              the signal's window; fills are taken at its midpoint. No fill in
              the window means no trade.
            </li>
            <li>
              After the fill, whichever of invalidation or target trades first
              decides the result. If both fall inside one candle, the
              invalidation is assumed first.
            </li>
            <li>
              A moved stop applies from the candle after the target that moved
              it (inside one candle the order of high and low is unknown).
              Results for the whole position: <strong>−1R</strong> at the stop,{' '}
              <strong>+⅓R</strong> when TP1 is booked and the rest returns to
              entry, <strong>+1⅓R</strong> after TP2 with the last third closed
              at TP1, <strong>+2R</strong> when all three targets trade.
            </li>
            <li>
              A trade that filled is followed after its window closes, even when
              newer signals are published, until its target or invalidation
              trades. Anything still open at the Friday close is closed there at
              the last price, since day trades are not held over the weekend
              gap.
            </li>
            <li>
              If a new window points the same way (or is neutral) while that
              trade is still open, nothing new is published: the open trade
              stays the pair's signal, marked <strong>Still valid</strong>, so
              one move is never counted twice. A new call in the opposite
              direction is published with a warning to close or reduce the open
              trade first.
            </li>
            <li>Neutral calls are stand-asides and are never scored.</li>
            <li>
              If no candles cover a window (for example after a long outage),
              the signal is marked unscored rather than judged against a later
              price.
            </li>
          </ol>
          <p>
            The hit rate counts only targets and invalidations; breakevens and
            early exits are in net pips but not the hit rate; cancelled signals
            and neutral calls are not scored. Pips are signed in the trade's
            direction.
          </p>
        </section>

        <section>
          <h2>6. Sessions and killzones</h2>
          <p>
            All windows are fixed in UTC, the clock the FX market is scheduled
            on. The last column shows the same window in your time zone (
            {tzLabel('local')}).
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Window</th>
                  <th>UTC</th>
                  {localDiffersFromUtc() && (
                    <th>Your time ({tzLabel('local')})</th>
                  )}
                  <th>What to expect</th>
                </tr>
              </thead>
              <tbody>
                {WINDOWS.map(([name, start, end, note]) => (
                  <tr key={name}>
                    <td className="strong">{name}</td>
                    <td className="num">{hourRange(start, end, 'utc')}</td>
                    {localDiffersFromUtc() && (
                      <td className="num">{hourRange(start, end, 'local')}</td>
                    )}
                    <td>{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Killzones are the first hours of the London and New York cash
            sessions, when most of the day's range is usually set. Signal
            windows are separate: they open at{' '}
            {[0, 7, 12].map((h) => utcHourAs(h, 'utc')).join(', ')} UTC (Asia,
            London, New York)
            {localDiffersFromUtc()
              ? ` (${[0, 7, 12].map((h) => utcHourAs(h, 'local')).join(', ')} your time)`
              : ''}
            .
          </p>
        </section>

        <section>
          <h2>Limits</h2>
          <p>
            Two pairs only. Data comes from Twelve Data (prices) and Trading
            Economics (calendar) on rate-limited plans, so a provider outage
            means no signal for that window rather than an invented one.
            FXSignal is research and education, not financial advice; it does
            not place orders or know your account.
          </p>
        </section>
      </article>
    </>
  );
}
