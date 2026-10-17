import { useEffect, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { adminApi } from '../lib/api';
import { price } from '../lib/format';
import { LIFECYCLE, reasonLabel } from '../lib/reasons';
import { Select } from './ui/Select';
import { Empty, Spinner } from './ui/Empty';
import type { AnalyticsReport, PairCode, ReplayFrame } from '../lib/types';

// ---- Signal-quality analytics ---------------------------------------------------

/**
 * Results by one dimension with sample size and a 90% range for the average
 * R. Groups that are small or whose range spans zero are marked: they are
 * not evidence for a new rule.
 */
export function AnalyticsPanel() {
  const [source, setSource] = useState<'live' | 'backtest'>('backtest');
  const [dimension, setDimension] = useState('session');
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setError(null);
    adminApi
      .analytics({ source, dimension }, ctrl.signal)
      .then(setReport)
      .catch((err) => {
        if (!ctrl.signal.aborted)
          setError(err instanceof Error ? err.message : 'Unavailable.');
      });
    return () => ctrl.abort();
  }, [source, dimension]);

  const r = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}R`;
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Signal quality</h2>
          <p>{report?.note ?? 'Expectancy by condition, with sample size.'}</p>
        </div>
        <div className="page-actions">
          <Select
            label="Source"
            value={source}
            onChange={(v) => setSource(v)}
            options={[
              { value: 'backtest', label: 'Backtest' },
              { value: 'live', label: 'Live' },
            ]}
            active={false}
            minWidth={120}
          />
          <Select
            label="Group by"
            value={dimension}
            onChange={setDimension}
            options={(report?.dimensions ?? [{ key: 'session', label: 'Session' }]).map((d) => ({
              value: d.key,
              label: d.label,
            }))}
            active={false}
            minWidth={170}
          />
        </div>
      </div>
      {error ? (
        <Empty icon="chart" title="Analytics unavailable">
          {error}
        </Empty>
      ) : !report ? (
        <div className="panel-body">
          <div className="skeleton" style={{ height: 120 }} />
        </div>
      ) : report.groups.length === 0 ? (
        <Empty icon="chart" title="No scored trades yet" />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{report.dimensions.find((d) => d.key === dimension)?.label}</th>
                  <th className="r">Trades</th>
                  <th className="r">Win rate</th>
                  <th className="r" data-tip="Average R per trade: the expectancy.">
                    Avg R
                  </th>
                  <th className="r" data-tip="90% bootstrap range for the average R. If it spans zero, the group's edge is not established.">
                    90% range
                  </th>
                  <th className="r">Net R</th>
                  <th className="r">Max DD</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {report.groups.map((g) => (
                  <tr key={g.key} className={g.inconclusive ? 'faint' : ''}>
                    <td className="strong">{g.key}</td>
                    <td className="r num">{g.trades}</td>
                    <td className="r num">{g.winRate === null ? '—' : `${g.winRate.toFixed(0)}%`}</td>
                    <td className={`r num ${g.avgR > 0 ? 'up' : g.avgR < 0 ? 'down' : ''}`}>{r(g.avgR)}</td>
                    <td className="r num">
                      {r(g.avgRLow)} … {r(g.avgRHigh)}
                    </td>
                    <td className="r num">{r(g.netR)}</td>
                    <td className="r num">−{g.maxDrawdownR.toFixed(2)}R</td>
                    <td>
                      {g.inconclusive && (
                        <span
                          className="tag"
                          data-tip={
                            g.trades < report.minSample
                              ? `Fewer than ${report.minSample} trades.`
                              : 'The 90% range includes zero.'
                          }
                        >
                          Inconclusive
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="faint" style={{ fontSize: 12, margin: '10px 18px 14px' }}>
            {report.total} trades. A condition earns a rule only if it holds on
            data it was not chosen on (the locked holdout, or new live
            results) — not because it looks good here.
          </p>
        </>
      )}
    </section>
  );
}

// ---- Replay / research mode -------------------------------------------------------

const PAIRS: PairCode[] = ['EUR/USD', 'USD/JPY'];
const STEP_MS = 15 * 60_000;

function toInput(ms: number) {
  return new Date(ms).toISOString().slice(0, 16);
}

/**
 * Candle-by-candle replay over the backtest's cached history: only what was
 * known at that moment, the call the engine made at the window start, and
 * where it stood. "Reveal" shows the real outcome, to compare.
 */
export function ReplayPanel() {
  const [pair, setPair] = useState<PairCode>('EUR/USD');
  const [at, setAt] = useState(() => {
    const d = new Date(Date.now() - 14 * 86_400_000);
    d.setUTCHours(9, 0, 0, 0);
    return d.getTime();
  });
  const [reveal, setReveal] = useState(false);
  const [frame, setFrame] = useState<ReplayFrame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    adminApi
      .replay(pair, new Date(at).toISOString(), reveal, ctrl.signal)
      .then(setFrame)
      .catch((err) => {
        if (!ctrl.signal.aborted) {
          setFrame(null);
          setError(err instanceof Error ? err.message : 'Unavailable.');
        }
      })
      .finally(() => !ctrl.signal.aborted && setLoading(false));
    return () => ctrl.abort();
  }, [pair, at, reveal]);

  const step = (bars: number) => setAt((t) => t + bars * STEP_MS);
  const s = frame?.signal;
  const pr = frame?.progress;
  const stageIndex = pr ? LIFECYCLE.findIndex((x) => x.stage === pr.stage) : -1;

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Replay</h2>
          <p>
            Step through cached history candle by candle. Only candles closed
            by the time shown are used, so any look-ahead would show up here.
          </p>
        </div>
      </div>
      <div className="replay-bar">
        <Select
          label="Pair"
          value={pair}
          onChange={(v) => setPair(v as PairCode)}
          options={PAIRS.map((p) => ({ value: p, label: p }))}
          active={false}
          minWidth={120}
        />
        <input
          className="input"
          type="datetime-local"
          aria-label="Replay time (UTC)"
          value={toInput(at)}
          onChange={(e) => {
            const t = Date.parse(`${e.target.value}:00Z`);
            if (Number.isFinite(t)) setAt(t);
          }}
        />
        <span className="faint">UTC</span>
        <div className="segmented" aria-label="Step">
          <button onClick={() => step(-4)}>−1h</button>
          <button onClick={() => step(-1)}>−15m</button>
          <button onClick={() => step(1)}>+15m</button>
          <button onClick={() => step(4)}>+1h</button>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          aria-pressed={reveal}
          onClick={() => setReveal((r) => !r)}
          data-tip="Show the real outcome. It uses candles after this moment, so keep it off while judging the call."
        >
          {reveal ? 'Hide outcome' : 'Reveal outcome'}
        </button>
        {loading && <Spinner />}
      </div>
      {error ? (
        <Empty icon="chart" title="Nothing to replay">
          {error}
        </Empty>
      ) : frame ? (
        <>
          <ReplayChart frame={frame} />
          <div className="replay-info">
            <div>
              <span className="label">Window</span>
              <strong>
                {frame.window
                  ? `${frame.window.label} ${frame.window.start.slice(11, 16)}–${frame.window.end.slice(11, 16)} UTC`
                  : 'Outside the trading windows'}
              </strong>
            </div>
            <div>
              <span className="label">Call at window start</span>
              <strong className={s?.direction === 'LONG' ? 'up' : s?.direction === 'SHORT' ? 'down' : ''}>
                {s
                  ? s.direction === 'NEUTRAL'
                    ? `Stand aside${s.reasonCode ? ` — ${reasonLabel(s.reasonCode)}` : ''}`
                    : `${s.direction === 'LONG' ? 'Long' : 'Short'} ${price(pair, s.entryLow)}–${price(pair, s.entryHigh)} · stop ${price(pair, s.stop)} · ${s.confidence}%`
                  : '—'}
              </strong>
            </div>
            {pr && (
              <div>
                <span className="label">Now</span>
                <strong>
                  {LIFECYCLE[stageIndex]?.label ?? (pr.stage === 'VOID' ? 'Void' : pr.stage)}
                  {pr.fillPrice !== null && ` · filled ${price(pair, pr.fillPrice)}`}
                  {pr.pips !== null && ` · ${pr.pips > 0 ? '+' : ''}${pr.pips.toFixed(1)}p`}
                </strong>
              </div>
            )}
            {frame.outcome && (
              <div>
                <span className="label">Actual outcome</span>
                <strong>
                  {frame.outcome.status}
                  {frame.outcome.pips !== null && ` · ${frame.outcome.pips > 0 ? '+' : ''}${frame.outcome.pips.toFixed(1)}p`}
                </strong>
                <em className="faint">{frame.outcome.note}</em>
              </div>
            )}
          </div>
          {s && s.notes.length > 0 && (
            <ul className="replay-notes">
              {s.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div className="panel-body">
          <div className="skeleton" style={{ height: 300 }} />
        </div>
      )}
    </section>
  );
}

function ReplayChart({ frame }: { frame: ReplayFrame }) {
  const host = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const linesRef = useRef<ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']>[]>([]);

  useEffect(() => {
    if (!host.current) return;
    const decimals = frame.pair === 'EUR/USD' ? 5 : 3;
    const chart = createChart(host.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6c6c75',
        fontFamily: "'Geist Mono', ui-monospace, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.035)' },
        horzLines: { color: 'rgba(255,255,255,0.035)' },
      },
      timeScale: { timeVisible: true, secondsVisible: false, rightOffset: 4 },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#2fbf85',
      downColor: '#ef5a5f',
      wickUpColor: '#2fbf85',
      wickDownColor: '#ef5a5f',
      borderVisible: false,
      priceLineVisible: false,
      priceFormat: { type: 'price', precision: decimals, minMove: 10 ** -decimals },
    });
    chartRef.current = chart;
    seriesRef.current = series;
    markersRef.current = createSeriesMarkers(series, []);
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      markersRef.current = null;
      linesRef.current = [];
    };
  }, [frame.pair]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    series.setData(frame.candles.map((c) => ({ ...c, time: c.time as UTCTimestamp })));
    for (const l of linesRef.current) series.removePriceLine(l);
    linesRef.current = [];
    const s = frame.signal;
    if (s && s.direction !== 'NEUTRAL') {
      const line = (p: number, color: string, title: string, dashed = false) =>
        linesRef.current.push(
          series.createPriceLine({
            price: p,
            color,
            lineWidth: 1,
            lineStyle: dashed ? LineStyle.Dashed : LineStyle.Solid,
            axisLabelVisible: true,
            title,
          })
        );
      line(s.entryHigh, '#ededef', 'Entry', true);
      line(s.entryLow, '#ededef', 'Entry', true);
      line(s.stop, '#ef5a5f', 'Stop');
      line(s.tp1, '#2fbf85', 'TP1', true);
      line(s.tp2, '#2fbf85', 'TP2', true);
      if (s.tp3 !== null) line(s.tp3, '#2fbf85', 'TP3');
    }
    const long = s?.direction === 'LONG';
    const snap = (ms: number) => {
      const t = Math.floor(ms / 1000);
      return [...frame.candles].reverse().find((c) => c.time <= t)?.time;
    };
    const markers = [
      frame.window ? { at: Date.parse(frame.window.start), text: 'Window', color: '#8b8b94' } : null,
      frame.progress?.touchedAt ? { at: frame.progress.touchedAt, text: 'In zone', color: '#8b8b94' } : null,
      frame.progress?.filledAt ? { at: frame.progress.filledAt, text: 'Entry', color: '#ededef' } : null,
      ...(s?.blackouts ?? []).map((b) => ({ at: b.from, text: 'News', color: '#d6a446' })),
    ]
      .flatMap((m) => {
        if (!m) return [];
        const time = snap(m.at);
        return time === undefined
          ? []
          : [{
              time: time as UTCTimestamp,
              position: m.text === 'Entry' ? (long ? 'belowBar' : 'aboveBar') : 'aboveBar',
              shape: m.text === 'Entry' ? (long ? 'arrowUp' : 'arrowDown') : 'circle',
              color: m.color,
              text: m.text,
            } as const];
      })
      .sort((a, b) => a.time - b.time);
    markersRef.current?.setMarkers(markers);
    chartRef.current?.timeScale().scrollToRealTime();
  }, [frame]);

  return <div ref={host} className="pchart-canvas" style={{ height: 320 }} />;
}
