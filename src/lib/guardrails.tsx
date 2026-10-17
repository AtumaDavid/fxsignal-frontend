import { useCallback, useEffect, useState } from 'react';
import { riskApi } from './api';
import {
  lotPipValue,
  readSizerPrefs,
  type Currency,
} from '../components/PositionSizer';
import type { TimeZonePref } from './prefs';
import type { Mt5Account, PairCode, UserTrade } from './types';

export interface RiskPrefs {
  enabled: boolean;
  /** Stop for the day after losing this % of the account. */
  dailyLossPct: number | null;
  maxTradesPerDay: number | null;
  balance: number | null;
  currency: Currency;
  /** Stop for the week after losing this % of the account. */
  weeklyLossPct?: number | null;
  maxOpenPositions?: number | null;
  /** Net lots per currency (USD, EUR, JPY) across open trades. */
  maxCurrencyLots?: number | null;
  /** Pause once equity is this % below its peak (MT5) or the journal's peak. */
  drawdownPausePct?: number | null;
  maxRiskPerTradePct?: number | null;
  /** Round-turn commission per standard lot (hand-logged trades). */
  commissionPerLot?: number | null;
}

export const DEFAULT_RISK_PREFS: RiskPrefs = {
  enabled: false,
  dailyLossPct: 3,
  maxTradesPerDay: 3,
  balance: null,
  currency: 'USD',
  weeklyLossPct: 6,
  maxOpenPositions: 2,
  maxCurrencyLots: null,
  drawdownPausePct: 10,
  maxRiskPerTradePct: 2,
  commissionPerLot: null,
};

// One fetch shared by every component that shows a guardrail.
let cache: { prefs: RiskPrefs; mt5: Mt5Account | null } | null = null;
let inflight: Promise<{ prefs: RiskPrefs; mt5: Mt5Account | null }> | null = null;
const listeners = new Set<(p: { prefs: RiskPrefs; mt5: Mt5Account | null }) => void>();

function load() {
  inflight ??= riskApi
    .get()
    .then((r) => (cache = { prefs: { ...DEFAULT_RISK_PREFS, ...r.prefs }, mt5: r.mt5 }))
    .catch(() => ({ prefs: DEFAULT_RISK_PREFS, mt5: null }))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useRiskPrefs() {
  const [state, setState] = useState(cache);
  useEffect(() => {
    listeners.add(setState);
    if (!cache) void load().then(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);
  const save = useCallback(async (next: RiskPrefs) => {
    const { prefs: saved } = await riskApi.save(next);
    cache = { prefs: { ...DEFAULT_RISK_PREFS, ...saved }, mt5: cache?.mt5 ?? null };
    listeners.forEach((fn) => fn(cache!));
  }, []);
  return { prefs: state?.prefs ?? null, mt5: state?.mt5 ?? null, save };
}

/** Calendar day of `value` in the user's chosen time zone. */
function dayKey(value: string | Date, tz: TimeZonePref) {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(tz === 'utc' ? { timeZone: 'UTC' } : {}),
  }).format(new Date(value));
}

export interface TodayRisk {
  /** Trades opened (logged) today. */
  tradesToday: number;
  /** Net result of trades closed today, in the account currency. */
  pnl: number;
  /** Loss as a % of the balance (0 when up on the day). */
  lossPct: number;
  /** True when some trades had no lot size and were estimated from the risk %. */
  estimated: boolean;
  lossLimitHit: boolean;
  /** At least 75% of the daily loss limit used. */
  lossNear: boolean;
  tradeLimitHit: boolean;
}

/**
 * Today's risk from the journal. Trades with a lot size use their real pip
 * value; trades without one are estimated as R × the calculator's risk %.
 */
export function todayRisk(
  trades: UserTrade[],
  prefs: RiskPrefs,
  priceOf: (pair: PairCode) => number | null,
  tz: TimeZonePref,
  now = new Date()
): TodayRisk | null {
  const balance = prefs.balance ?? Number(readSizerPrefs().balance);
  if (!prefs.enabled || !Number.isFinite(balance) || balance <= 0) return null;
  const today = dayKey(now, tz);
  const riskPct = Number(readSizerPrefs().riskPct) || 1;

  const tradesToday = trades.filter(
    (t) => dayKey(t.createdAt, tz) === today
  ).length;
  let pnl = 0;
  let estimated = false;
  for (const t of trades) {
    if (t.pips === null || !t.exitedAt || dayKey(t.exitedAt, tz) !== today)
      continue;
    const pipValue = lotPipValue(
      t.prediction.pairCode,
      prefs.currency,
      priceOf
    );
    if (t.lots && pipValue) {
      pnl += t.pips * pipValue * t.lots;
      continue;
    }
    const stop = t.prediction.stopPips;
    if (!stop) continue;
    estimated = true;
    pnl += (t.pips / stop) * balance * (riskPct / 100);
  }
  const lossPct = pnl < 0 ? (Math.abs(pnl) / balance) * 100 : 0;
  const limit = prefs.dailyLossPct;
  return {
    tradesToday,
    pnl,
    lossPct,
    estimated,
    lossLimitHit: limit !== null && lossPct >= limit,
    lossNear: limit !== null && lossPct >= limit * 0.75,
    tradeLimitHit:
      prefs.maxTradesPerDay !== null && tradesToday >= prefs.maxTradesPerDay,
  };
}

/** Monday of the week of `value` in the user's time zone, as a day key. */
function weekKey(value: string | Date, tz: TimeZonePref) {
  const day = dayKey(value, tz);
  const d = new Date(`${day}T00:00:00Z`);
  const shift = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - shift);
  return d.toISOString().slice(0, 10);
}

export interface CurrencyExposure {
  currency: 'USD' | 'EUR' | 'JPY';
  /** + long, − short, in standard lots of the pair's base. */
  netLots: number;
  positions: number;
  overLimit: boolean;
}

export interface AccountRisk extends TodayRisk {
  weekPnl: number;
  weekLossPct: number;
  weekLimitHit: boolean;
  openPositions: number;
  openLimitHit: boolean;
  exposure: CurrencyExposure[];
  /** Equity below its peak: MT5 when synced, else the journal's last 30 days. */
  drawdownPct: number | null;
  drawdownSource: 'mt5' | 'journal' | null;
  drawdownHit: boolean;
  /** Something says stop: daily, weekly or drawdown limit. */
  paused: boolean;
  pauseReason: string | null;
}

/** Signed net lots per currency for one trade: long EUR/USD = +EUR −USD. */
function legs(pair: PairCode, side: 'LONG' | 'SHORT', lots: number) {
  const [base, quote] = pair.split('/') as ('USD' | 'EUR' | 'JPY')[];
  const sign = side === 'LONG' ? 1 : -1;
  return [
    { currency: base, lots: sign * lots },
    { currency: quote, lots: -sign * lots },
  ];
}

/**
 * Today, this week, open positions, currency exposure and drawdown from the
 * journal (and the MT5 account snapshot). Only warns: nothing is blocked.
 */
export function accountRisk(
  trades: UserTrade[],
  prefs: RiskPrefs,
  priceOf: (pair: PairCode) => number | null,
  tz: TimeZonePref,
  mt5: Mt5Account | null = null,
  now = new Date()
): AccountRisk | null {
  const today = todayRisk(trades, prefs, priceOf, tz, now);
  if (!today) return null;
  const balance = prefs.balance ?? Number(readSizerPrefs().balance);
  const riskPct = Number(readSizerPrefs().riskPct) || 1;
  const pnlOf = (t: UserTrade) => {
    if (t.pips === null) return 0;
    const pipValue = lotPipValue(t.prediction.pairCode, prefs.currency, priceOf);
    if (t.lots && pipValue) return t.pips * pipValue * t.lots + (t.commission ?? 0);
    const stop = t.prediction.stopPips;
    return stop ? (t.pips / stop) * balance * (riskPct / 100) : 0;
  };

  const week = weekKey(now, tz);
  const weekPnl = trades
    .filter((t) => t.exitedAt && weekKey(t.exitedAt, tz) === week)
    .reduce((sum, t) => sum + pnlOf(t), 0);
  const weekLossPct = weekPnl < 0 ? (Math.abs(weekPnl) / balance) * 100 : 0;
  const weekLimitHit =
    prefs.weeklyLossPct != null && weekLossPct >= prefs.weeklyLossPct;

  const open = trades.filter((t) => t.exitPrice === null && !t.exitedAt);
  const openLimitHit =
    prefs.maxOpenPositions != null && open.length > prefs.maxOpenPositions;
  const byCurrency = new Map<CurrencyExposure['currency'], { lots: number; positions: number }>();
  for (const t of open) {
    for (const leg of legs(t.prediction.pairCode, t.side, t.lots ?? 0)) {
      const cur = byCurrency.get(leg.currency) ?? { lots: 0, positions: 0 };
      cur.lots += leg.lots;
      cur.positions += 1;
      byCurrency.set(leg.currency, cur);
    }
  }
  const exposure: CurrencyExposure[] = (['USD', 'EUR', 'JPY'] as const).map((currency) => {
    const e = byCurrency.get(currency) ?? { lots: 0, positions: 0 };
    return {
      currency,
      netLots: Number(e.lots.toFixed(2)),
      positions: e.positions,
      overLimit: prefs.maxCurrencyLots != null && Math.abs(e.lots) > prefs.maxCurrencyLots,
    };
  });

  // Drawdown: MT5 equity when synced; otherwise the journal's closed-trade
  // curve over the last 30 days, against the balance.
  let drawdownPct: number | null = null;
  let drawdownSource: AccountRisk['drawdownSource'] = null;
  if (mt5?.drawdownPct !== undefined) {
    drawdownPct = mt5.drawdownPct;
    drawdownSource = 'mt5';
  } else {
    const since = now.getTime() - 30 * 86_400_000;
    const closed = trades
      .filter((t) => t.exitedAt && new Date(t.exitedAt).getTime() >= since)
      .sort((a, b) => a.exitedAt!.localeCompare(b.exitedAt!));
    if (closed.length > 0) {
      let equity = 0;
      let peak = 0;
      let worst = 0;
      for (const t of closed) {
        equity += pnlOf(t);
        peak = Math.max(peak, equity);
        worst = Math.max(worst, peak - equity);
      }
      drawdownPct = Number(((worst / balance) * 100).toFixed(2));
      drawdownSource = 'journal';
    }
  }
  const drawdownHit =
    prefs.drawdownPausePct != null && drawdownPct !== null && drawdownPct >= prefs.drawdownPausePct;
  const pauseReason = drawdownHit
    ? `Drawdown ${drawdownPct!.toFixed(1)}% is past your ${prefs.drawdownPausePct}% limit`
    : weekLimitHit
      ? `Down ${weekLossPct.toFixed(1)}% this week — your weekly limit is ${prefs.weeklyLossPct}%`
      : today.lossLimitHit
        ? `Down ${today.lossPct.toFixed(1)}% today — your daily limit is ${prefs.dailyLossPct}%`
        : null;
  return {
    ...today,
    weekPnl,
    weekLossPct,
    weekLimitHit,
    openPositions: open.length,
    openLimitHit,
    exposure,
    drawdownPct,
    drawdownSource,
    drawdownHit,
    paused: pauseReason !== null,
    pauseReason,
  };
}
