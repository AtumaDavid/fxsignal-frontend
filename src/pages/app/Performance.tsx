import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { Journal } from '../../components/Journal';
import { PipsChart } from '../../components/PipsChart';
import { Empty } from '../../components/ui/Empty';
import { signedPips } from '../../lib/format';
import { usePrefs } from '../../lib/prefs';
import { usePerformance } from '../../lib/usePerformance';
import type { PerformanceBucket } from '../../lib/types';

export function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: PerformanceBucket[];
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
      </div>
      {rows.length === 0 ? (
        <Empty icon="activity" title="No data yet" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{title.replace('By ', '')}</th>
                <th className="r">Signals</th>
                <th className="r">Scored</th>
                <th className="r">Hit rate</th>
                <th className="r">Net pips</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td className="strong">{row.key}</td>
                  <td className="r num">{row.signals}</td>
                  <td className="r num">{row.scored}</td>
                  <td className="r num">
                    {row.hitRate === null ? '—' : `${row.hitRate.toFixed(1)}%`}
                  </td>
                  <td
                    className={`r num ${row.netPips > 0 ? 'up' : row.netPips < 0 ? 'down' : ''}`}
                  >
                    {signedPips(row.netPips)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function Performance() {
  const { timeZone } = usePrefs();
  const { data, error, loading } = usePerformance(365);
  const totals = data?.totals;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Performance</h1>
          <p>
            Each signal is replayed against M15 candles after its window closes.
            Only trades whose entry zone actually traded count toward the hit
            rate; neutral calls and untriggered entries are reported separately.
          </p>
        </div>
        <div className="page-actions">
          <Link
            to="/track-record"
            className="btn btn-secondary"
            target="_blank"
          >
            Public track record <Icon name="external" size={13} />
          </Link>
        </div>
      </div>

      <div className="stack">
        {data?.capped && (
          <div className="alert">
            <span>
              Track record covers the last{' '}
              <strong>{data.appliedDays} days</strong> on the Free plan.{' '}
              <Link to="/app/billing" className="link">
                Upgrade for the full year
              </Link>
              .
            </span>
          </div>
        )}

        <section className="kpis">
          <div className="kpi">
            <span
              className="label"
              data-tip="Targets ÷ (targets + stops). Only trades whose entry actually triggered count; early exits, cancellations and neutral calls are excluded."
            >
              Hit rate
            </span>
            <div className="kpi-value">
              {totals?.hitRate != null ? (
                <>
                  {totals.hitRate.toFixed(1)}
                  <small>%</small>
                </>
              ) : (
                '—'
              )}
            </div>
            <span className="kpi-note">
              {totals ? `${totals.hits} targets · ${totals.misses} stops` : '—'}
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
              className={`kpi-value ${totals && totals.netPips > 0 ? 'up' : totals && totals.netPips < 0 ? 'down' : ''}`}
            >
              {totals ? signedPips(totals.netPips) : '—'}
            </div>
            <span className="kpi-note">Scored trades, both pairs</span>
          </div>
          <div className="kpi">
            <span
              className="label"
              data-tip="Every signal published in this period, whatever its result."
            >
              Published
            </span>
            <div className="kpi-value">{totals?.signals ?? '—'}</div>
            <span className="kpi-note">
              {totals
                ? `${totals.breakeven ?? 0} breakeven · ${totals.closedEarly} closed early · ${totals.cancelled} cancelled · ${totals.neutral} neutral · ${totals.notTriggered} not triggered · ${totals.pending} open`
                : '—'}
            </span>
          </div>
          <div className="kpi">
            <span
              className="label"
              data-tip="Average agreement between the daily, 4-hour, 1-hour and 15-minute charts. It is not a win probability."
            >
              Avg. confidence
            </span>
            <div className="kpi-value">
              {totals?.avgConfidence != null ? (
                <>
                  {totals.avgConfidence}
                  <small>%</small>
                </>
              ) : (
                '—'
              )}
            </div>
            <span className="kpi-note">Across published signals</span>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Cumulative net pips</h2>
              <p>Steps at each settlement · scored trades only</p>
            </div>
          </div>
          {error ? (
            <Empty icon="activity" title="Performance unavailable">
              {error}
            </Empty>
          ) : loading && !data ? (
            <div className="panel-body">
              <div className="skeleton" style={{ height: 200 }} />
            </div>
          ) : data && data.curve.length > 0 ? (
            <PipsChart curve={data.curve} timeZone={timeZone} />
          ) : (
            <Empty icon="activity" title="No scored trades yet">
              The curve starts once a signal's entry zone trades and its target
              or invalidation is reached.
            </Empty>
          )}
        </section>

        <div className="grid-2">
          <Breakdown title="By pair" rows={data?.byPair ?? []} />
          <Breakdown title="By session" rows={data?.bySession ?? []} />
        </div>

        <Journal />
      </div>
    </>
  );
}
