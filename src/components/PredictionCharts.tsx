import { PriceChart, type ChartEvent, type ChartLevel } from './PriceChart';
import { tradeTargets } from '../lib/targets';
import type { Prediction, WeeklyOutlook } from '../lib/types';

const RESULT_LABEL = {
  HIT: 'Target hit',
  MISSED: 'Stopped',
  CLOSED_EARLY: 'Closed early',
  BREAKEVEN: 'Breakeven',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
  PENDING: 'Expired',
} as const;

/**
 * The signal on the tape: entry zone, invalidation and target over the candles,
 * with the publish and expiry points marked — so the call can be checked
 * against what price actually did.
 */
export function SignalChart({
  prediction,
  height,
}: {
  prediction: Prediction;
  height?: number;
}) {
  const p = prediction;
  const tps = tradeTargets(p);
  const levels: ChartLevel[] = [
    ...(tps
      ? ([
          { price: tps.tp3, label: 'TP3', tone: 'up' },
          { price: tps.tp2, label: 'TP2', tone: 'up', style: 'dashed' },
          { price: tps.tp1, label: 'TP1', tone: 'up', style: 'dashed' },
        ] as ChartLevel[])
      : ([
          { price: p.targetPrice, label: 'Target', tone: 'up' },
        ] as ChartLevel[])),
    {
      price: p.entryHigh,
      label: 'Entry',
      tone: 'ink',
      style: 'dashed',
      legend: 'Entry zone',
    },
    {
      price: p.entryLow,
      label: 'Entry',
      tone: 'ink',
      style: 'dashed',
      legend: 'Entry zone',
    },
    {
      price: p.invalidationPrice,
      label: 'Stop',
      tone: 'down',
      legend: 'Stop',
    },
  ];
  const expired = new Date(p.expiresAt).getTime() <= Date.now();
  const long = p.direction === 'LONG';
  const events: ChartEvent[] = [
    { at: p.validFrom, label: 'Published', tone: 'ink' },
  ];
  // The trade's life on the tape: zone touch, the confirming candle (entry),
  // TP1/TP2, and the news windows in which no entry could fill.
  const live = p.live;
  const filledAt = live?.filledAt ?? p.outcome?.filledAt ?? null;
  if (live?.touchedAt && live.touchedAt !== filledAt)
    events.push({ at: live.touchedAt, label: 'In zone', tone: 'muted', position: 'inBar', shape: 'circle' });
  if (filledAt)
    events.push({
      at: filledAt,
      label: p.entryTrigger === 'M15_CLOSE' ? 'Confirmed · entry' : 'Entry',
      tone: 'ink',
      position: long ? 'belowBar' : 'aboveBar',
      shape: long ? 'arrowUp' : 'arrowDown',
    });
  if (live?.tp1At) events.push({ at: live.tp1At, label: 'TP1', tone: 'up', position: long ? 'aboveBar' : 'belowBar', shape: 'circle' });
  if (live?.tp2At) events.push({ at: live.tp2At, label: 'TP2', tone: 'up', position: long ? 'aboveBar' : 'belowBar', shape: 'circle' });
  if (live?.newsBlockedAt)
    events.push({ at: live.newsBlockedAt, label: 'Blocked: news', tone: 'muted', shape: 'square' });
  for (const b of p.blackouts ?? [])
    events.push({ at: new Date(b.from).toISOString(), label: 'News: no entry', tone: 'muted', shape: 'square' });
  const status = p.outcome?.status ?? 'PENDING';
  const checkpoint = status === 'CANCELLED' || status === 'CLOSED_EARLY';
  if (checkpoint && p.outcome?.evaluatedAt) {
    // Decided on an H1 close: mark the candle that closed just before.
    events.push({
      at: new Date(
        new Date(p.outcome.evaluatedAt).getTime() - 5 * 60_000
      ).toISOString(),
      label: RESULT_LABEL[status],
      tone: 'muted',
    });
  } else if (expired) {
    events.push({
      at: new Date(new Date(p.expiresAt).getTime() - 1000).toISOString(),
      label: RESULT_LABEL[status],
      tone: status === 'HIT' ? 'up' : status === 'MISSED' ? 'down' : 'muted',
    });
  }
  // Older signals fall outside the 15-minute history (~2 days); start on 1h.
  const age = Date.now() - new Date(p.validFrom).getTime();
  return (
    <PriceChart
      pair={p.pairCode}
      timeframes={['M15', 'H1', 'H4']}
      defaultTimeframe={age > 36 * 3_600_000 ? 'H1' : 'M15'}
      levels={levels}
      events={events}
      focusFrom={p.validFrom}
      height={height}
    />
  );
}

/** The week's levels to mark and the three scenario targets over the candles. */
export function OutlookChart({
  outlook,
  height,
}: {
  outlook: WeeklyOutlook;
  height?: number;
}) {
  const o = outlook;
  const resistances = [...o.resistances].sort((a, b) => a - b);
  const supports = [...o.supports].sort((a, b) => b - a);
  const levels: ChartLevel[] = [
    ...resistances.map((price, i) => ({
      price,
      label: `R${i + 1}`,
      tone: 'down' as const,
      style: 'dotted' as const,
      legend: 'Resistance',
    })),
    ...supports.map((price, i) => ({
      price,
      label: `S${i + 1}`,
      tone: 'up' as const,
      style: 'dotted' as const,
      legend: 'Support',
    })),
    {
      price: o.scenarios.bull.target,
      label: 'Bull',
      tone: 'up',
      style: 'dashed',
      legend: 'Bull target',
    },
    {
      price: o.scenarios.base.target,
      label: 'Base',
      tone: 'muted',
      style: 'dashed',
      legend: 'Base target',
    },
    {
      price: o.scenarios.bear.target,
      label: 'Bear',
      tone: 'down',
      style: 'dashed',
      legend: 'Bear target',
    },
  ];
  const events: ChartEvent[] =
    new Date(o.weekStart).getTime() <= Date.now()
      ? [{ at: o.weekStart, label: 'Week open', tone: 'ink' }]
      : [];
  return (
    <PriceChart
      pair={o.pairCode}
      timeframes={['H1', 'H4', 'DAILY', 'WEEKLY']}
      defaultTimeframe="H4"
      levels={levels.filter((l) => Number.isFinite(l.price) && l.price > 0)}
      events={events}
      height={height}
    />
  );
}
