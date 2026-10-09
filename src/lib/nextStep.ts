import { price, signedPips } from './format';
import type { Prediction } from './types';

export type StepTone = 'wait' | 'act' | 'hold' | 'done' | 'skip' | 'exit';

export interface NextStep {
  tone: StepTone;
  /** Short instruction, e.g. "Wait for the entry". */
  title: string;
  /** One sentence with the numbers needed to act on it. */
  detail: string;
}

/**
 * The single thing a trader should do with this signal right now, in plain
 * language. Everything on the card supports this line.
 */
export function nextStep(p: Prediction, now = Date.now()): NextStep {
  const pair = p.pairCode;
  const stop = price(pair, p.invalidationPrice);
  const target = price(pair, p.targetPrice);
  const zone = `${price(pair, p.entryLow)}–${price(pair, p.entryHigh)}`;
  const long = p.direction === 'LONG';
  const o = p.outcome;
  const cleanNote = (note: string | null | undefined) =>
    note?.replace(/^(Cancelled before entry|Exit suggested): /, '') ?? '';

  if (o?.status === 'CANCELLED')
    return {
      tone: 'skip',
      title: 'Skip this one',
      detail:
        `Cancelled before entry. ${cleanNote(o.note)} Don't enter; a new setup may follow at a later H1 close.`.trim(),
    };
  if (o?.status === 'CLOSED_EARLY')
    return {
      tone: 'exit',
      title: 'Exit if you are in this trade',
      detail:
        `Suggested exit at ${price(pair, o.resolvedPrice)} (${signedPips(o.movementPips)}p). ${cleanNote(o.note)}`.trim(),
    };
  if (o?.status === 'HIT')
    return {
      tone: 'done',
      title: 'Done — target hit',
      detail: `Closed at ${target} (${signedPips(o.movementPips)}p).`,
    };
  if (o?.status === 'MISSED')
    return {
      tone: 'done',
      title: 'Done — stopped out',
      detail: `Closed at ${stop} (${signedPips(o.movementPips)}p).`,
    };
  if (o?.status === 'EXPIRED')
    return o.movementPips === null
      ? {
          tone: 'skip',
          title: 'No trade',
          detail: 'The entry zone was never reached in its window.',
        }
      : {
          tone: 'done',
          title: 'Done — window ended',
          detail: `Marked to the last price (${signedPips(o.movementPips)}p).`,
        };

  if (p.continuesId)
    return {
      tone: 'hold',
      title: 'Keep your earlier trade open',
      detail: `No new entry this window. Stop ${stop}, target ${target}.`,
    };
  if (p.direction === 'NEUTRAL')
    return {
      tone: 'skip',
      title: 'No trade this window',
      detail: p.factors[0] ?? 'The timeframes do not line up. Stand aside.',
    };

  const live = p.live;
  if (p.carried && live?.state === 'running')
    return p.carried.reconfirmed
      ? {
          tone: 'hold',
          title: 'Still valid — let it run',
          detail: `The ${p.carried.window} analysis agrees with this trade, so there is no new signal. Stop ${stop}, target ${target}${live.pips !== null ? `, now ${signedPips(live.pips)}p` : ''}.`,
        }
      : {
          tone: 'wait',
          title: 'Manage on its own levels',
          detail: `The ${p.carried.window} analysis is neutral now. Keep the stop at ${stop} and the target at ${target}${live.pips !== null ? ` (now ${signedPips(live.pips)}p)` : ''}; no new entry.`,
        };
  if (live?.state === 'target')
    return {
      tone: 'done',
      title: 'Target reached',
      detail: `Hit ${target} (${signedPips(live.pips)}p). Take profit if you are in.`,
    };
  if (live?.state === 'stopped')
    return {
      tone: 'done',
      title: 'Stopped out',
      detail: `Hit ${stop} (${signedPips(live.pips)}p).`,
    };
  if (live?.state === 'running')
    return {
      tone: 'hold',
      title: 'In the trade — let it run',
      detail: `Stop ${stop}, target ${target}${live.pips !== null ? `, now ${signedPips(live.pips)}p` : ''}. You'll get an alert when it closes.`,
    };

  if (new Date(p.expiresAt).getTime() <= now)
    return {
      tone: 'skip',
      title: 'Window closed',
      detail: 'This signal is being settled.',
    };

  return {
    tone: 'act',
    title: `Wait to ${long ? 'buy' : 'sell'} in the zone`,
    detail: `When price reaches ${zone}, wait for a 15-minute candle to close ${long ? 'up' : 'down'}, then ${long ? 'buy' : 'sell'}. Stop ${stop}, target ${target}.`,
  };
}
