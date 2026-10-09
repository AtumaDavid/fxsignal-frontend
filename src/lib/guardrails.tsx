import { useCallback, useEffect, useState } from 'react';
import { riskApi } from './api';
import {
  lotPipValue,
  readSizerPrefs,
  type Currency,
} from '../components/PositionSizer';
import type { TimeZonePref } from './prefs';
import type { PairCode, UserTrade } from './types';

export interface RiskPrefs {
  enabled: boolean;
  /** Stop for the day after losing this % of the account. */
  dailyLossPct: number | null;
  maxTradesPerDay: number | null;
  balance: number | null;
  currency: Currency;
}

export const DEFAULT_RISK_PREFS: RiskPrefs = {
  enabled: false,
  dailyLossPct: 3,
  maxTradesPerDay: 3,
  balance: null,
  currency: 'USD',
};

// One fetch shared by every component that shows a guardrail.
let cache: RiskPrefs | null = null;
let inflight: Promise<RiskPrefs> | null = null;
const listeners = new Set<(p: RiskPrefs) => void>();

function load() {
  inflight ??= riskApi
    .get()
    .then(({ prefs }) => (cache = prefs))
    .catch(() => DEFAULT_RISK_PREFS)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useRiskPrefs() {
  const [prefs, setPrefs] = useState<RiskPrefs | null>(cache);
  useEffect(() => {
    listeners.add(setPrefs);
    if (!cache) void load().then(setPrefs);
    return () => {
      listeners.delete(setPrefs);
    };
  }, []);
  const save = useCallback(async (next: RiskPrefs) => {
    const { prefs: saved } = await riskApi.save(next);
    cache = saved;
    listeners.forEach((fn) => fn(saved));
  }, []);
  return { prefs, save };
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
