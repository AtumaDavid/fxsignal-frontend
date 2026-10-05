export type PairCode = 'EUR/USD' | 'USD/JPY';
export type Direction = 'LONG' | 'SHORT' | 'NEUTRAL';
export type Impact = 'LOW' | 'MEDIUM' | 'HIGH';
export type OutcomeStatus = 'PENDING' | 'HIT' | 'MISSED' | 'EXPIRED';
export type OutcomeSource = 'DEMO' | 'LIVE';
export type PredictionEngine = 'RULE_BASED' | 'DEEPSEEK';

export interface User {
  id: number;
  email: string;
  name: string;
  plan: string;
  planStatus?: string;
  createdAt: string;
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
  state: 'neutral' | 'waiting' | 'running' | 'target' | 'stopped';
  filledAt: string | null;
  closedAt: string | null;
  pips: number | null;
  /** −100 (at the stop) … +100 (at the target). */
  progress: number | null;
  lastPrice: number | null;
  asOf: string | null;
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
  targetPrice: number;
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
