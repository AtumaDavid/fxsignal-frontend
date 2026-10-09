import { useEffect, useMemo, useRef, useState } from 'react';
import { dateTime, signedPips } from '../lib/format';
import type { TimeZonePref } from '../lib/prefs';
import type { PerformanceSummary } from '../lib/types';

const HEIGHT = 220;
const PAD = { top: 16, right: 56, bottom: 26, left: 44 };

function niceStep(range: number, target = 4) {
  const raw = range / target;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const norm = raw / mag;
  return (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
}

/**
 * Cumulative net pips over scored signals — one series, so no legend: the
 * panel title names it. Neutral ink line on a recessive grid, a zero baseline,
 * an end label, and a crosshair tooltip snapped to the nearest settlement.
 */
export function PipsChart({
  curve,
  timeZone,
  unit = 'pips',
}: {
  curve: PerformanceSummary['curve'];
  timeZone: TimeZonePref;
  /** What the values are: pips (default) or R multiples. */
  unit?: 'pips' | 'R';
}) {
  const fmt = (v: number) =>
    unit === 'R'
      ? `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}R`
      : signedPips(v);
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(280, Math.floor(entry.contentRect.width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Start from zero so the first settlement reads as a step from flat.
  const points = useMemo(() => {
    if (curve.length === 0) return [];
    const first = new Date(curve[0].at).getTime();
    return [
      {
        at: new Date(first - 1).toISOString(),
        pips: 0,
        pairCode: curve[0].pairCode,
      },
      ...curve,
    ];
  }, [curve]);

  const geometry = useMemo(() => {
    if (points.length === 0) return null;
    const times = points.map((p) => new Date(p.at).getTime());
    const values = points.map((p) => p.pips);
    const t0 = Math.min(...times);
    const t1 = Math.max(...times);
    const step = niceStep(
      Math.max(...values, 0) - Math.min(...values, 0) || 10
    );
    const yMin = Math.floor(Math.min(...values, 0) / step) * step;
    const yMax = Math.ceil(Math.max(...values, 0) / step) * step || step;
    const innerW = width - PAD.left - PAD.right;
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    const x = (t: number) =>
      PAD.left + (t1 === t0 ? innerW : ((t - t0) / (t1 - t0)) * innerW);
    const y = (v: number) =>
      PAD.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
    const ticks: number[] = [];
    for (let v = yMin; v <= yMax + 1e-9; v += step)
      ticks.push(Number(v.toFixed(6)));
    const xy = points.map((p, i) => ({ ...p, x: x(times[i]), y: y(p.pips) }));
    // Step line: equity only changes when a signal settles.
    let d = `M${xy[0].x},${xy[0].y}`;
    for (let i = 1; i < xy.length; i += 1) d += `H${xy[i].x}V${xy[i].y}`;
    const area = `${d}V${y(0)}H${xy[0].x}Z`;
    return { xy, d, area, ticks, y, zero: y(0) };
  }, [points, width]);

  if (!geometry) return null;
  const { xy, d, area, ticks, y, zero } = geometry;
  const last = xy[xy.length - 1];
  const active = hover !== null ? xy[hover] : null;

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * width;
    let best = 1;
    for (let i = 1; i < xy.length; i += 1) {
      if (Math.abs(xy[i].x - px) < Math.abs(xy[best].x - px)) best = i;
    }
    setHover(best);
  };

  return (
    <div className="chart" ref={wrap}>
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        height={HEIGHT}
        role="img"
        aria-label={`Cumulative net ${unit}, ending at ${fmt(last.pips)}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <g className="chart-axis">
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke={
                  t === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.06)'
                }
                strokeWidth={1}
              />
              <text x={PAD.left - 8} y={y(t) + 3.5} textAnchor="end">
                {t > 0 ? `+${t}` : t}
              </text>
            </g>
          ))}
          <text x={PAD.left} y={HEIGHT - 6}>
            {dateTime(xy[1]?.at ?? xy[0].at, timeZone)}
          </text>
          <text x={width - PAD.right} y={HEIGHT - 6} textAnchor="end">
            {dateTime(last.at, timeZone)}
          </text>
        </g>
        <path
          d={area}
          fill={last.pips >= 0 ? 'var(--up)' : 'var(--down)'}
          opacity={0.1}
        />
        <path
          d={d}
          fill="none"
          stroke="var(--text)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <line
          x1={PAD.left}
          x2={width - PAD.right}
          y1={zero}
          y2={zero}
          stroke="rgba(255,255,255,0.22)"
        />
        {active && (
          <line
            x1={active.x}
            x2={active.x}
            y1={PAD.top}
            y2={HEIGHT - PAD.bottom}
            stroke="rgba(255,255,255,0.3)"
          />
        )}
        <circle
          cx={(active ?? last).x}
          cy={(active ?? last).y}
          r={4}
          fill="var(--text)"
          stroke="var(--surface)"
          strokeWidth={2}
        />
        {!active && (
          <text
            x={last.x + 10}
            y={last.y + 4}
            className="num"
            style={{
              fontSize: 12,
              fill: 'var(--text)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {fmt(last.pips)}
          </text>
        )}
      </svg>
      {active && (
        <div
          className="chart-tip"
          style={{ left: `${(active.x / width) * 100}%`, top: active.y + 18 }}
        >
          <span>
            {dateTime(active.at, timeZone)}
            {active.pairCode ? ` · ${active.pairCode}` : ''}
          </span>
          <strong>
            {fmt(active.pips)}
            {unit === 'pips' ? ' pips' : ''}
          </strong>
        </div>
      )}
    </div>
  );
}
