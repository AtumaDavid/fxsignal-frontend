import type { Prediction } from './types';

export interface TradeTargets {
  tp1: number;
  tp2: number;
  tp3: number;
}

/**
 * The three targets of a managed trade (a third off at each; the stop trails
 * to entry after TP1, to TP1 after TP2), or null on older single-target
 * signals and stand-asides.
 */
export function tradeTargets(p: Prediction): TradeTargets | null {
  if (!p.target3Price || p.direction === 'NEUTRAL') return null;
  const mid = (p.entryLow + p.entryHigh) / 2;
  return {
    tp1: p.target1Price ?? mid + (mid - p.invalidationPrice),
    tp2: p.targetPrice,
    tp3: p.target3Price,
  };
}
