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
          <h2>1. Six timeframes, weighted top-down</h2>
          <p>
            For each pair the engine pulls monthly, weekly, daily, H4, H1 and
            M15 candles and computes EMA 20/50/200, RSI 14, ATR 14 and the
            20-bar swing range. Each timeframe gets a bias score from −100 to
            +100. Higher timeframes carry more weight, so a fast chart can
            refine a call but not overturn the trend on its own.
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Timeframe</th>
                  <th className="r">Weight</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Monthly', 30, 'Regime'],
                  ['Weekly', 25, 'Regime'],
                  ['Daily', 20, 'Trend for the session'],
                  ['H4', 12, 'Swing structure'],
                  ['H1', 8, 'Volatility (ATR) and structure for levels'],
                  ['M15', 5, 'Timing and current price'],
                ].map(([tf, w, role]) => (
                  <tr key={tf}>
                    <td className="strong">{tf}</td>
                    <td className="r num">{w}</td>
                    <td>{role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            A weighted score of +12 or more publishes <strong>Long</strong>, −12
            or less <strong>Short</strong>, anything between{' '}
            <strong>Neutral</strong>. Confidence (15–92%) rises with timeframe
            agreement and falls when fast momentum disagrees with the trend or
            when a high-impact release lands inside the window (−10 per high, −3
            per medium, capped at −20).
          </p>
        </section>

        <section>
          <h2>2. Levels from volatility and structure</h2>
          <ul>
            <li>
              The entry zone is centred on the current price and sized from H1
              ATR (6–30 pips wide).
            </li>
            <li>
              The invalidation sits beyond the recent swing, 12–80 pips from the
              zone.
            </li>
            <li>
              The target is set for at least 1.5R, 20–120 pips beyond the zone.
            </li>
            <li>
              When the model review is enabled, a language model may adjust
              direction, confidence and levels, and writes the session playbook.
              Its levels pass through the same guard-rails, and reward:risk is
              recomputed from whatever is finally published.
            </li>
          </ul>
        </section>

        <section>
          <h2>3. Cadence</h2>
          <p>
            Windows open at 00:00, 06:00, 12:00 and 18:00 UTC while spot FX
            trades (Sunday 22:00 to Friday 22:00 UTC). A signal covers the rest
            of its window and never outlives the Friday close. Over the weekend
            the engine publishes a week-ahead outlook instead of intraday calls.
          </p>
        </section>

        <section>
          <h2>4. Scoring</h2>
          <p>
            After a window closes, its signal is replayed against M15 candles
            (H1 if M15 is unavailable):
          </p>
          <ol>
            <li>
              No position exists until price trades into the entry zone; fills
              are taken at its midpoint.
            </li>
            <li>
              After the fill, whichever of invalidation or target trades first
              decides the result. If both fall inside one candle, the
              invalidation is assumed first.
            </li>
            <li>
              If neither is reached, the signal expires and is marked to the
              last close.
            </li>
            <li>Neutral calls are stand-asides and are never scored.</li>
            <li>
              If no candles cover a window (for example after a long outage),
              the signal is marked unscored rather than judged against a later
              price.
            </li>
          </ol>
          <p>
            The hit rate counts only targets and invalidations. Pips are signed
            in the trade's direction.
          </p>
        </section>

        <section>
          <h2>5. Sessions and killzones</h2>
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
            {[0, 6, 12, 18].map((h) => utcHourAs(h, 'utc')).join(', ')} UTC
            {localDiffersFromUtc()
              ? ` (${[0, 6, 12, 18].map((h) => utcHourAs(h, 'local')).join(', ')} your time)`
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
