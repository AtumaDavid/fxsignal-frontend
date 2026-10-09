export type PairCode = 'EUR/USD' | 'USD/JPY';
export type Direction = 'LONG' | 'SHORT' | 'NEUTRAL';
export type Impact = 'LOW' | 'MEDIUM' | 'HIGH';
export type OutcomeStatus =
  | 'PENDING'
  | 'HIT'
  | 'MISSED'
  | 'EXPIRED'
  /** Withdrawn before entry on an H1 close (never a trade). */
  | 'CANCELLED'
  /** Exited early on strong H1 evidence (in net pips, not the hit rate). */
  | 'CLOSED_EARLY'
  /** +1R reached, stop moved to entry, closed there for 0 (not in the hit rate). */
  | 'BREAKEVEN';
export type OutcomeSource = 'DEMO' | 'LIVE';
export type PredictionEngine = 'RULE_BASED' | 'DEEPSEEK';

export interface User {
  id: number;
  email: string;
  name: string;
  plan: string;
  planStatus?: string;
  createdAt: string;
  /** Listed in the server's ADMIN_EMAILS. */
  isAdmin?: boolean;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface PredictionOutcome {
  status: OutcomeStatus;
  resolvedPrice: number | null;
  movementPips: number | null;
  evaluatedAt: string | null;
  source: OutcomeSource;
  note: string | null;
}

export interface TimeframeVote {
  timeframe: string;
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  score: number;
}

export interface LiveProgress {
  /** target: closed in profit (TP3, or the trailed stop after TP1/TP2). */
  state: 'neutral' | 'waiting' | 'running' | 'target' | 'stopped';
  filledAt: string | null;
  closedAt: string | null;
  /** Whole position, blending the thirds already booked at TP1/TP2. */
  pips: number | null;
  /** −100 (at the stop) … +100 (at the final target). */
  progress: number | null;
  lastPrice: number | null;
  asOf: string | null;
  /** Targets reached so far (0–3). */
  tpHits?: number;
  tp1At?: string | null;
  tp2At?: string | null;
  /** Where the stop is now: original → entry after TP1 → TP1 after TP2. */
  stopNow?: number | null;
}

export interface NewsRisk {
  title: string;
  currency: string;
  at: string;
  impact: Impact;
}

export interface Prediction {
  id: string;
  pairCode: PairCode;
  windowKey: string;
  direction: Direction;
  engine: PredictionEngine;
  modelName: string | null;
  confidence: number;
  entryLow: number;
  entryHigh: number;
  /** TP2 with three targets; the single target on older signals. */
  targetPrice: number;
  /** TP1 (+1R) and TP3 (+1R beyond TP2). Null on older single-target signals. */
  target1Price?: number | null;
  target3Price?: number | null;
  invalidationPrice: number;
  rationale: string;
  factors: string[];
  session: string;
  playbook: string | null;
  timeframeBias: TimeframeVote[] | null;
  stopPips: number | null;
  targetPips: number | null;
  riskReward: number | null;
  atrPips: number | null;
  validFrom: string;
  expiresAt: string;
  createdAt: string;
  outcome: PredictionOutcome | null;
  live?: LiveProgress | null;
  /** High-impact releases for the pair's currencies around this signal. */
  news?: NewsRisk[];
  /** "Hold" call: id of the still-open earlier signal this window manages. */
  continuesId?: string | null;
  /**
   * This earlier trade is the pair's current signal because the latest
   * analysis carried it (no new signal was published).
   */
  carried?: { reconfirmed: boolean; window: string; at: string } | null;
}

export interface MarketEvent {
  id: string;
  currency: string;
  title: string;
  eventDate: string;
  impact: Impact;
  forecast: string | null;
  previousValue: string | null;
}

export type WeeklyBias = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface WeeklyScenario {
  trigger: string;
  target: number;
}

export interface WeeklyOutlook {
  id: string;
  weekKey: string;
  pairCode: PairCode;
  bias: WeeklyBias;
  confidence: number;
  headline: string;
  narrative: string;
  supports: number[];
  resistances: number[];
  scenarios: {
    bull: WeeklyScenario;
    base: WeeklyScenario;
    bear: WeeklyScenario;
  };
  catalysts: string[];
  tradingPlan: string;
  engine: PredictionEngine;
  modelName: string | null;
  weekStart: string;
  weekEnd: string;
  createdAt: string;
}

export interface TickerPrice {
  pairCode: PairCode;
  price: number | null;
  changePercent: number | null;
  asOf: string | null;
}

export interface DashboardData {
  generatedAt: string;
  cadence: string;
  marketStatus: 'OPEN' | 'CLOSED';
  currentSession: string;
  killzoneLabel: string | null;
  playbookHint: string | null;
  predictions: Prediction[];
  /** Earlier signals that triggered and are still running past their window. */
  openTrades?: Prediction[];
  history: Prediction[];
  events: MarketEvent[];
  prices: TickerPrice[];
  weeklyOutlook: WeeklyOutlook[];
  stats: {
    hitRate: number;
    totalSignals: number;
    avgConfidence: number;
    nextRefresh: string;
  };
  /** Whether the live market providers are enabled in the backend configuration. */
  liveDataEnabled: boolean;
  /** Whether the backend has any real market content to display. */
  dataAvailable: boolean;
}

export interface BillingPlan {
  id: string;
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  features: string[];
  limits: { historyDays: number; historyLimit: number };
}

export interface AccountInfo {
  user: User;
  plan: BillingPlan;
  usage: {
    totalSignals: number;
    hits: number;
    misses: number;
    historyDays: number;
  };
}

export interface HistoryPage {
  items: Prediction[];
  appliedDays: number;
  appliedLimit: number;
  requestedDays: number;
  plan: string;
  capped: boolean;
}

export interface PerformanceBucket {
  key: string;
  signals: number;
  scored: number;
  hits: number;
  misses: number;
  hitRate: number | null;
  netPips: number;
  avgConfidence: number | null;
}

export interface PerformanceSummary {
  totals: PerformanceBucket & {
    notTriggered: number;
    pending: number;
    neutral: number;
    closedEarly: number;
    cancelled: number;
    breakeven?: number;
  };
  byPair: PerformanceBucket[];
  bySession: PerformanceBucket[];
  curve: { at: string; pips: number; pairCode: PairCode }[];
  appliedDays: number;
  plan: string;
  capped: boolean;
}

export interface UserTrade {
  id: string;
  predictionId: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number | null;
  exitPrice: number | null;
  lots: number | null;
  /** The user's own stop / target; when set, the exit is detected automatically. */
  stopPrice: number | null;
  targetPrice: number | null;
  exitedAt: string | null;
  /** 'stop' | 'target' when detected automatically, 'manual' when typed. */
  exitReason: string | null;
  notes: string | null;
  /** Signed by the user's side; null until entry and exit are both set. */
  pips: number | null;
  createdAt: string;
  updatedAt: string;
  prediction: Prediction;
}

export interface JournalData {
  trades: UserTrade[];
  summary: {
    logged: number;
    closed: number;
    open: number;
    wins: number;
    losses: number;
    netPips: number;
    engineNetPips: number;
    engineScored: number;
  };
  /** Closed trades grouped, best net pips first. */
  byPair?: JournalBreakdown[];
  bySession?: JournalBreakdown[];
}

export interface JournalBreakdown {
  key: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  netPips: number;
  avgPips: number;
}

export interface PublicCall {
  id: string;
  pairCode: PairCode;
  direction: Direction;
  session: string;
  confidence: number;
  validFrom: string;
  expiresAt: string;
  entryLow: number;
  entryHigh: number;
  targetPrice: number;
  target1Price?: number | null;
  target3Price?: number | null;
  invalidationPrice: number;
  status: OutcomeStatus;
  movementPips: number | null;
}

export interface PublicTrackRecord extends Omit<
  PerformanceSummary,
  'appliedDays' | 'plan' | 'capped'
> {
  days: number;
  generatedAt: string;
  recent: PublicCall[];
}

export interface AppNotification {
  id: string;
  kind: string;
  title: string;
  body: string;
  predictionId: string | null;
  createdAt: string;
  read: boolean;
}

export type AlertGroup =
  'newSignal' | 'entry' | 'result' | 'checkpoint' | 'myTrades';

export interface AlertPrefs {
  channels: { email: boolean; push: boolean };
  events: Record<AlertGroup, boolean>;
}

export interface AlertSettings {
  prefs: AlertPrefs;
  email: string;
  emailAvailable: boolean;
  pushAvailable: boolean;
  vapidPublicKey: string | null;
  pushDevices: number;
}

export interface RecapGroup {
  key: string;
  trades: number;
  wins: number;
  losses: number;
  netPips: number;
  netR: number;
}

export interface WeeklyRecap {
  weekStart: string;
  weekEnd: string;
  weeks: string[];
  engine: {
    signals: number;
    closed: number;
    open: number;
    notTriggered: number;
    cancelled: number;
    wins: number;
    losses: number;
    winRate: number | null;
    netPips: number;
    netR: number;
    best: { id: string; pairCode: PairCode; pips: number } | null;
    worst: { id: string; pairCode: PairCode; pips: number } | null;
  };
  days: { date: string; trades: number; netPips: number }[];
  byPair: RecapGroup[];
  bySession: RecapGroup[];
  you: {
    logged: number;
    closed: number;
    wins: number;
    losses: number;
    netPips: number;
  };
  trades: Prediction[];
}

export interface AdminOverview {
  server: {
    startedAt: string;
    uptimeSec: number;
    node: string;
    memoryMb: number;
    dbOk: boolean;
    dbLatencyMs: number;
  };
  jobs: {
    startedAt: string;
    maintenance: {
      at: string;
      ms: number;
      ok: boolean;
      error: string | null;
    } | null;
    candleLoopAt: string | null;
  };
  config: {
    liveData: boolean;
    modelReview: boolean;
    email: boolean;
    push: boolean;
    calendar: boolean;
    admins: number;
  };
  credits: {
    day: string;
    usedToday: number;
    dailyLimit: number;
    lastMinute: number;
    perMinuteLimit: number;
  };
  series: {
    key: string;
    newest: string | null;
    ageMinutes: number | null;
    stale: boolean;
    backingOff: boolean;
  }[];
  counts: {
    users: number;
    pro: number;
    newThisWeek: number;
    activeToday: number;
    pushDevices: number;
    journalTrades: number;
  };
  signals: {
    open: number;
    publishedToday: number;
    lastByPair: {
      pairCode: PairCode;
      at: string;
      direction: Direction;
      status: OutcomeStatus;
    }[];
  };
  alerts: {
    sentToday: number;
    failedToday: number;
    failures: {
      id: number;
      userId: number | null;
      channel: string;
      kind: string;
      error: string;
      createdAt: string;
    }[];
  };
}

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  plan: string;
  planStatus: string;
  createdAt: string;
  lastSeenAt: string | null;
  trades: number;
  pushDevices: number;
}
