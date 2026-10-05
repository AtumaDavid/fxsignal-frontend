import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type MouseEventParams,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { Empty } from './ui/Empty';
import { getCandles, type CandleSeries, type ChartTimeframe } from '../lib/api';
import { dateTime, price, tzLabel } from '../lib/format';
import { EMA_COLORS, EMA_PERIODS, ema, rsiSeries } from '../lib/indicators';
import { usePrefs } from '../lib/prefs';
import type { PairCode } from '../lib/types';

export type LevelTone = 'up' | 'down' | 'ink' | 'muted';

export interface ChartLevel {
  price: number;
  /** Short axis label, e.g. "Target" or "R1". */
  label: string;
  tone: LevelTone;
  style?: 'solid' | 'dashed' | 'dotted';
  /** Legend entry; lines sharing one (e.g. every resistance) are listed once. */
  legend?: string;
}

export interface ChartEvent {
  at: string;
  label: string;
  tone?: LevelTone;
}

const COLORS: Record<LevelTone, string> = {
  up: '#2fbf85',
  down: '#ef5a5f',
  ink: '#ededef',
  muted: '#8b8b94',
};

const LINE_STYLE = {
  solid: LineStyle.Solid,
  dashed: LineStyle.Dashed,
  dotted: LineStyle.Dotted,
} as const;

const RSI_PANE_HEIGHT = 92;
const INDICATOR_PREF_KEY = 'fxsignal_chart_indicators';

function readIndicatorPref(): { ema: boolean; rsi: boolean } {
  try {
    const raw = localStorage.getItem(INDICATOR_PREF_KEY);
    if (raw) return { ema: true, rsi: true, ...JSON.parse(raw) };
  } catch {
    // Defaults below.
  }
  return { ema: true, rsi: true };
}

const TF_LABEL: Record<ChartTimeframe, string> = {
  M15: '15m',
  H1: '1h',
  H4: '4h',
  DAILY: '1D',
  WEEKLY: '1W',
  MONTHLY: '1M',
};

/** The chart lib renders timestamps as UTC; shift them to show local time. */
function shift(seconds: number, local: boolean) {
  if (!local) return seconds;
  return seconds - new Date(seconds * 1000).getTimezoneOffset() * 60;
}

/**
 * Candlestick chart with the prediction drawn on it: entry, invalidation and
 * target (or the week's levels and scenario targets) as labelled price lines,
 * and markers where the signal was published and expired. Candles come from
 * the engine's own cache, so opening a chart never spends provider credits.
 */
export function PriceChart({
  pair,
  timeframes,
  defaultTimeframe,
  levels,
  events = [],
  focusFrom,
  height = 340,
}: {
  pair: PairCode;
  timeframes: ChartTimeframe[];
  defaultTimeframe: ChartTimeframe;
  levels: ChartLevel[];
  events?: ChartEvent[];
  /** Keep this instant in view (e.g. when the signal was published). */
  focusFrom?: string;
  height?: number;
}) {
  const { timeZone } = usePrefs();
  const local = timeZone === 'local';
  const [timeframe, setTimeframe] = useState(defaultTimeframe);
  const [series, setSeries] = useState<CandleSeries | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(readIndicatorPref);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const toggle = (key: 'ema' | 'rsi') =>
    setShow((current) => {
      const next = { ...current, [key]: !current[key] };
      try {
        localStorage.setItem(INDICATOR_PREF_KEY, JSON.stringify(next));
      } catch {
        // Applies to this page view only.
      }
      return next;
    });

  const host = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const linesRef = useRef<IPriceLine[]>([]);
  const emaRefs = useRef(new Map<number, ISeriesApi<'Line'>>());
  const rsiRef = useRef<ISeriesApi<'Line'> | null>(null);
  const timeIndex = useRef(new Map<number, number>());

  // Same formulas as the engine (lib/indicators mirrors technical.ts).
  const indicators = useMemo(() => {
    const closes = series?.candles.map((c) => c.close) ?? [];
    return {
      ema: EMA_PERIODS.map((period) => ({
        period,
        values: ema(closes, period),
      })),
      rsi: rsiSeries(closes, 14),
    };
  }, [series]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getCandles(pair, timeframe)
      .then((next) => !cancelled && setSeries(next))
      .catch(
        (err) =>
          !cancelled &&
          setError(
            err instanceof Error ? err.message : 'Chart data is unavailable.'
          )
      );
    return () => {
      cancelled = true;
    };
  }, [pair, timeframe]);

  const hasData = (series?.candles.length ?? 0) > 0;

  // Create the chart once there is something to draw.
  useEffect(() => {
    if (!hasData || !host.current || chartRef.current) return;
    const decimals = pair === 'EUR/USD' ? 5 : 3;
    const chart = createChart(host.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6c6c75',
        fontFamily: "'Geist Mono', ui-monospace, monospace",
        fontSize: 11,
        panes: {
          separatorColor: 'rgba(255,255,255,0.08)',
          separatorHoverColor: 'rgba(255,255,255,0.14)',
        },
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.035)' },
        horzLines: { color: 'rgba(255,255,255,0.035)' },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(255,255,255,0.25)',
          labelBackgroundColor: '#1e1e23',
        },
        horzLine: {
          color: 'rgba(255,255,255,0.25)',
          labelBackgroundColor: '#1e1e23',
        },
      },
    });
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: COLORS.up,
      downColor: COLORS.down,
      wickUpColor: COLORS.up,
      wickDownColor: COLORS.down,
      borderVisible: false,
      priceLineVisible: false,
      priceFormat: {
        type: 'price',
        precision: decimals,
        minMove: 10 ** -decimals,
      },
    });
    chartRef.current = chart;
    candlesRef.current = candles;
    markersRef.current = createSeriesMarkers(candles, []);
    const onMove = (param: MouseEventParams<Time>) => {
      const index =
        param.time === undefined
          ? undefined
          : timeIndex.current.get(param.time as number);
      setHoverIndex(index ?? null);
    };
    chart.subscribeCrosshairMove(onMove);
    return () => {
      chart.unsubscribeCrosshairMove(onMove);
      emaRefs.current.clear();
      rsiRef.current = null;
      chart.remove();
      chartRef.current = null;
      candlesRef.current = null;
      markersRef.current = null;
      linesRef.current = [];
    };
  }, [hasData, pair]);

  const levelKey = useMemo(() => JSON.stringify(levels), [levels]);
  const eventKey = useMemo(() => JSON.stringify(events), [events]);

  // Draw candles, levels and markers.
  useEffect(() => {
    const chart = chartRef.current;
    const candles = candlesRef.current;
    if (!chart || !candles || !series || series.candles.length === 0) return;

    const data = series.candles.map((c) => ({
      ...c,
      time: shift(c.time, local) as UTCTimestamp,
    }));
    candles.setData(data);
    timeIndex.current = new Map(data.map((c, i) => [c.time as number, i]));

    // Keep every level on screen, not just the candles.
    const prices = levels.map((l) => l.price);
    candles.applyOptions({
      autoscaleInfoProvider: (
        original: () => {
          priceRange: { minValue: number; maxValue: number };
        } | null
      ) => {
        const result = original();
        if (!result || prices.length === 0) return result;
        return {
          ...result,
          priceRange: {
            minValue: Math.min(result.priceRange.minValue, ...prices),
            maxValue: Math.max(result.priceRange.maxValue, ...prices),
          },
        };
      },
    });

    for (const line of linesRef.current) candles.removePriceLine(line);
    linesRef.current = levels.map((level) =>
      candles.createPriceLine({
        price: level.price,
        color: COLORS[level.tone],
        lineWidth: 1,
        lineStyle: LINE_STYLE[level.style ?? 'solid'],
        axisLabelVisible: true,
        title: level.label,
      })
    );

    // Markers snap to the candle that contains the instant.
    const first = series.candles[0].time;
    const markers: SeriesMarker<Time>[] = events
      .map((event) => {
        const t = Math.floor(new Date(event.at).getTime() / 1000);
        if (t < first) return null;
        const bar = [...series.candles].reverse().find((c) => c.time <= t);
        if (!bar) return null;
        return {
          time: shift(bar.time, local) as UTCTimestamp,
          position: 'aboveBar' as const,
          shape: 'arrowDown' as const,
          color: COLORS[event.tone ?? 'muted'],
          text: event.label,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => (a.time as number) - (b.time as number));
    markersRef.current?.setMarkers(markers);

    // Frame the view: from shortly before the focus instant to the latest bar.
    const total = data.length;
    let from = Math.max(0, total - 120);
    if (focusFrom) {
      const t = Math.floor(new Date(focusFrom).getTime() / 1000);
      const index = series.candles.findIndex((c) => c.time >= t);
      if (index >= 0) from = Math.max(0, Math.min(from, index - 24));
    }
    chart.timeScale().setVisibleLogicalRange({ from, to: total + 5 });
  }, [series, levelKey, eventKey, local, focusFrom, hasData]);

  // Indicator overlays: EMAs on the price pane, RSI in its own pane below.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !series || series.candles.length === 0) return;
    const times = series.candles.map(
      (c) => shift(c.time, local) as UTCTimestamp
    );
    const points = (values: (number | null)[]) =>
      values.flatMap((value, i) =>
        value === null ? [] : [{ time: times[i], value }]
      );

    for (const { period, values } of indicators.ema) {
      let line = emaRefs.current.get(period);
      if (!show.ema) {
        if (line) chart.removeSeries(line);
        emaRefs.current.delete(period);
        continue;
      }
      if (!line) {
        line = chart.addSeries(LineSeries, {
          color: EMA_COLORS[period],
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
          // EMAs must not stretch the price scale away from the candles.
          autoscaleInfoProvider: () => null,
        });
        emaRefs.current.set(period, line);
      }
      line.setData(points(values));
    }

    if (!show.rsi) {
      if (rsiRef.current) chart.removeSeries(rsiRef.current);
      rsiRef.current = null;
      return;
    }
    if (!rsiRef.current) {
      const rsi = chart.addSeries(
        LineSeries,
        {
          color: '#a0a0a8',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          crosshairMarkerRadius: 3,
          priceFormat: { type: 'price', precision: 1, minMove: 0.1 },
          autoscaleInfoProvider: () => ({
            priceRange: { minValue: 0, maxValue: 100 },
          }),
        },
        1
      );
      for (const [level, style] of [
        [70, LineStyle.Dashed],
        [50, LineStyle.Dotted],
        [30, LineStyle.Dashed],
      ] as const) {
        rsi.createPriceLine({
          price: level,
          color: 'rgba(255,255,255,0.22)',
          lineWidth: 1,
          lineStyle: style,
          axisLabelVisible: false,
          title: '',
        });
      }
      rsiRef.current = rsi;
      chart.panes()[1]?.setHeight(RSI_PANE_HEIGHT);
    }
    rsiRef.current.setData(points(indicators.rsi));
  }, [series, indicators, show, local, hasData]);

  const legendIndex = hoverIndex ?? (series ? series.candles.length - 1 : null);
  const valueAt = (values: (number | null)[]) =>
    legendIndex === null ? null : (values[legendIndex] ?? null);

  const covers =
    !focusFrom ||
    !series ||
    series.candles.length === 0 ||
    series.candles[0].time * 1000 <= new Date(focusFrom).getTime();

  return (
    <div className="pchart">
      <div className="pchart-bar">
        {timeframes.length > 1 && (
          <div className="segmented" aria-label="Timeframe">
            {timeframes.map((tf) => (
              <button
                key={tf}
                aria-pressed={timeframe === tf}
                onClick={() => setTimeframe(tf)}
              >
                {TF_LABEL[tf]}
              </button>
            ))}
          </div>
        )}
        <div className="pchart-legend" aria-label="Line key">
          {dedupeTones(levels).map((level) => (
            <span key={level.label}>
              <i
                style={{
                  borderTopColor: COLORS[level.tone],
                  borderTopStyle:
                    level.style === 'dotted'
                      ? 'dotted'
                      : level.style === 'dashed'
                        ? 'dashed'
                        : 'solid',
                }}
              />
              {level.legend}
            </span>
          ))}
        </div>
        <span className="pchart-meta">
          {series?.asOf
            ? `Last candle ${dateTime(series.asOf, timeZone)} ${tzLabel(timeZone)}`
            : ''}
        </span>
      </div>
      {hasData && (
        <div className="pchart-ind" aria-label="Indicators">
          <button
            className="pchart-toggle"
            aria-pressed={show.ema}
            onClick={() => toggle('ema')}
          >
            EMA
          </button>
          {show.ema &&
            indicators.ema.map(({ period, values }) => {
              const value = valueAt(values);
              return (
                <span key={period} className="pchart-ind-item">
                  <i style={{ background: EMA_COLORS[period] }} />
                  EMA {period}
                  <b className="num">
                    {value === null ? 'n/a' : price(pair, value)}
                  </b>
                </span>
              );
            })}
          <span className="pchart-ind-sep" />
          <button
            className="pchart-toggle"
            aria-pressed={show.rsi}
            onClick={() => toggle('rsi')}
          >
            RSI
          </button>
          {show.rsi && (
            <span className="pchart-ind-item">
              <i style={{ background: '#a0a0a8' }} />
              RSI 14
              <b className="num">
                {valueAt(indicators.rsi)?.toFixed(1) ?? 'n/a'}
              </b>
              <em>
                {(() => {
                  const r = valueAt(indicators.rsi);
                  if (r === null) return '';
                  return r >= 70
                    ? 'overbought'
                    : r <= 30
                      ? 'oversold'
                      : r >= 55
                        ? 'bullish momentum'
                        : r <= 45
                          ? 'bearish momentum'
                          : 'neutral';
                })()}
              </em>
            </span>
          )}
          <span className="pchart-ind-note">
            {hoverIndex !== null ? 'At cursor' : 'Latest candle'}
          </span>
        </div>
      )}
      {error ? (
        <Empty icon="chart" title="Chart unavailable">
          {error}
        </Empty>
      ) : series && !hasData ? (
        <Empty icon="chart" title="No candles cached yet">
          The chart fills once the engine has pulled {TF_LABEL[timeframe]} data
          for {pair}.
        </Empty>
      ) : (
        <>
          <div
            ref={host}
            className="pchart-canvas"
            style={{ height: height + (show.rsi ? RSI_PANE_HEIGHT : 0) }}
            role="img"
            aria-label={`${pair} ${TF_LABEL[timeframe]} candles with the prediction's levels`}
          >
            {!series && <div className="skeleton" style={{ height: '100%' }} />}
          </div>
          {!covers && (
            <p className="pchart-note">
              The {TF_LABEL[timeframe]} history no longer reaches back to this
              signal's window — try a higher timeframe.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** One legend entry per kind of line (e.g. all resistances share one). */
function dedupeTones(levels: ChartLevel[]) {
  const seen = new Map<string, ChartLevel & { legend: string }>();
  for (const level of levels) {
    const legend = level.legend ?? level.label;
    if (!seen.has(legend))
      seen.set(legend, { ...level, label: legend, legend });
  }
  return [...seen.values()];
}
