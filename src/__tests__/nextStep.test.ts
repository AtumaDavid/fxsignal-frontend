import { describe, expect, it } from 'vitest';
import { nextStep } from '../lib/nextStep';
import type { LiveProgress, Prediction } from '../lib/types';

const NOW = Date.parse('2026-10-06T08:00:00Z');

function signal(overrides: Partial<Prediction> = {}): Prediction {
  return {
    id: '1',
    pairCode: 'EUR/USD',
    windowKey: '2026-10-06-LONDON',
    direction: 'LONG',
    engine: 'RULE_BASED',
    modelName: null,
    confidence: 70,
    entryLow: 1.1,
    entryHigh: 1.101,
    targetPrice: 1.1045,
    target1Price: 1.1025,
    target3Price: 1.1065,
    invalidationPrice: 1.0985,
    rationale: '',
    factors: [],
    session: 'London',
    playbook: null,
    timeframeBias: null,
    stopPips: 20,
    targetPips: 40,
    riskReward: 2,
    atrPips: 18,
    validFrom: '2026-10-06T07:00:00.000Z',
    expiresAt: '2026-10-06T12:00:00.000Z',
    createdAt: '2026-10-06T07:00:00.000Z',
    outcome: null,
    ...overrides,
  };
}

const live = (over: Partial<LiveProgress>): LiveProgress => ({
  state: 'running',
  filledAt: '2026-10-06T07:15:00.000Z',
  closedAt: null,
  pips: 5,
  progress: 10,
  lastPrice: 1.101,
  asOf: '2026-10-06T08:00:00.000Z',
  tpHits: 0,
  ...over,
});

describe('next step', () => {
  it('asks to wait for the zone with all three targets', () => {
    const step = nextStep(signal(), NOW);
    expect(step.tone).toBe('act');
    expect(step.detail).toMatch(/TP1 1\.10250, TP2 1\.10450, TP3 1\.10650/);
  });

  it('says to move the stop to entry at TP1', () => {
    const step = nextStep(signal({ live: live({ tpHits: 1 }) }), NOW);
    expect(step.title).toMatch(/TP1 hit — move your stop to entry/);
  });

  it('says to move the stop to TP1 at TP2', () => {
    const step = nextStep(signal({ live: live({ tpHits: 2 }) }), NOW);
    expect(step.title).toMatch(/TP2 hit — move your stop to TP1/);
  });

  it('reports a finished trade', () => {
    const done = nextStep(
      signal({ live: live({ state: 'target', tpHits: 3, pips: 40 }) }),
      NOW
    );
    expect(done.title).toBe('All 3 targets hit');
    const stopped = nextStep(
      signal({ live: live({ state: 'stopped', pips: -20 }) }),
      NOW
    );
    expect(stopped.title).toBe('Stopped out');
  });

  it('says skip when cancelled and stand aside when neutral', () => {
    expect(
      nextStep(
        signal({
          outcome: {
            status: 'CANCELLED',
            resolvedPrice: null,
            movementPips: null,
            evaluatedAt: null,
            source: 'LIVE',
            note: 'Cancelled before entry: H1 turned bearish.',
          },
        }),
        NOW
      ).title
    ).toBe('Skip this one');
    expect(nextStep(signal({ direction: 'NEUTRAL' }), NOW).title).toBe(
      'No trade this window'
    );
  });
});
