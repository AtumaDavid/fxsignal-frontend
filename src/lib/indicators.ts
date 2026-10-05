// Mirrors backend/src/lib/technical.ts exactly, so the chart shows the same
// EMA and RSI values the engine scored. Change them together.

/** EMA seeded with the simple average of the first `period` closes. */
export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i += 1) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/**
 * Rolling RSI over the last `period` changes using simple sums (Cutler's
 * RSI) — the backend computes this same value for the newest bar.
 */
export function rsiSeries(closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  for (let end = period; end < closes.length; end += 1) {
    let gain = 0;
    let loss = 0;
    for (let i = end - period + 1; i <= end; i += 1) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gain += diff;
      else loss -= diff;
    }
    out[end] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

export const EMA_PERIODS = [20, 50, 200] as const;

/** Validated categorical slots (dark surface): distinct from the up/down candle colours. */
export const EMA_COLORS: Record<(typeof EMA_PERIODS)[number], string> = {
  20: '#3987e5',
  50: '#c98500',
  200: '#d55181',
};
