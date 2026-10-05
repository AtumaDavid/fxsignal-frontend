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
