import type { LifecycleStage, ReasonCode } from './types';

/** Short labels for stand-aside and no-position reasons (mirrors the API). */
export const REASON_LABEL: Record<ReasonCode, string> = {
  CONTEXT_NEUTRAL: 'Daily/H4 context neutral',
  H1_AGAINST: 'H1 against the context',
  STRICT_WINDOW: 'Asia: not fully aligned',
  H1_NOT_REALIGNED: 'H1 not realigned after a stop',
  STOP_TOO_WIDE: 'Stop too wide for 1:2',
  NO_ZONE: 'No zone within reach',
  NO_ROOM: 'Target has no room',
  USD_EXPOSURE: 'USD exposure conflict',
  DAILY_LOSS_LIMIT: 'Daily loss limit',
  WIDE_SPREAD: 'Spread abnormally wide',
  MODEL_DOWNGRADE: 'Model review stood aside',
  NO_TOUCH: 'Price never reached the zone',
  NO_CONFIRMATION: 'No M15 confirmation',
  CONFIRMATION_EXPIRED: 'Confirmation expired',
  NEWS_BLACKOUT: 'Entry blocked by news',
  STOP_BEFORE_ENTRY: 'Stop traded before entry',
  MOVED_AWAY: 'Moved away without entry',
  H1_INVALIDATION: 'H1 closed beyond the stop',
  CONTEXT_FLIP: 'Daily/H4 context flipped',
  H1_TURNED: 'H1 turned against',
};

export function reasonLabel(code: ReasonCode | null | undefined) {
  return code ? (REASON_LABEL[code] ?? code) : null;
}

/** The steps a trade signal moves through, in order. */
export const LIFECYCLE: { stage: LifecycleStage; label: string }[] = [
  { stage: 'WAITING_FOR_ZONE', label: 'Waiting for zone' },
  { stage: 'IN_ZONE', label: 'In zone' },
  { stage: 'ENTERED', label: 'Entered' },
  { stage: 'TP1', label: 'TP1' },
  { stage: 'TP2', label: 'TP2' },
  { stage: 'CLOSED', label: 'Closed' },
];
