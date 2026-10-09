import { describe, expect, it } from 'vitest';
import { todayRisk, type RiskPrefs } from '../lib/guardrails';
import type { Prediction, UserTrade } from '../lib/types';

const NOW = new Date('2026-10-06T15:00:00Z');
const prefs: RiskPrefs = {
  enabled: true,
  dailyLossPct: 3,
  maxTradesPerDay: 2,
  balance: 10_000,
  currency: 'USD',
};

function trade(over: Partial<UserTrade>): UserTrade {
  return {
    id: 't',
    predictionId: '1',
    side: 'LONG',
    entryPrice: 1.1,
    exitPrice: 1.098,
    lots: 1,
    stopPrice: null,
    targetPrice: null,
    exitedAt: '2026-10-06T10:00:00.000Z',
    exitReason: 'manual',
    notes: null,
    pips: -20,
    createdAt: '2026-10-06T08:00:00.000Z',
    updatedAt: '2026-10-06T10:00:00.000Z',
    prediction: { pairCode: 'EUR/USD', stopPips: 20 } as Prediction,
    ...over,
  };
}

const priceOf = () => null;

describe('risk guardrails', () => {
  it('are off unless enabled', () => {
    expect(todayRisk([trade({})], { ...prefs, enabled: false }, priceOf, 'utc', NOW)).toBeNull();
  });

  it('measures today’s loss from lots and pip value', () => {
    // 1 lot EUR/USD: $10/pip × −20 pips = −$200 = 2% of $10,000.
    const risk = todayRisk([trade({})], prefs, priceOf, 'utc', NOW)!;
    expect(risk.pnl).toBe(-200);
    expect(risk.lossPct).toBeCloseTo(2, 6);
    expect(risk.lossLimitHit).toBe(false);
    expect(risk.lossNear).toBe(false);
  });

  it('flags the daily loss limit', () => {
    const risk = todayRisk(
      [trade({ id: 'a' }), trade({ id: 'b', pips: -15 })],
      prefs,
      priceOf,
      'utc',
      NOW
    )!;
    expect(risk.lossPct).toBeCloseTo(3.5, 6);
    expect(risk.lossLimitHit).toBe(true);
  });

  it('counts trades logged today against the cap, ignoring other days', () => {
    const risk = todayRisk(
      [
        trade({ id: 'a', pips: 10 }),
        trade({ id: 'b', pips: 10 }),
        trade({ id: 'c', createdAt: '2026-10-05T08:00:00.000Z', exitedAt: '2026-10-05T10:00:00.000Z' }),
      ],
      prefs,
      priceOf,
      'utc',
      NOW
    )!;
    expect(risk.tradesToday).toBe(2);
    expect(risk.tradeLimitHit).toBe(true);
    expect(risk.lossPct).toBe(0);
  });

  it('estimates trades without a lot size from R', () => {
    // −20 pips on a 20-pip stop = −1R; default 1% risk of $10,000 = −$100.
    const risk = todayRisk([trade({ lots: null })], prefs, priceOf, 'utc', NOW)!;
    expect(risk.estimated).toBe(true);
    expect(risk.pnl).toBeCloseTo(-100, 6);
  });
});
