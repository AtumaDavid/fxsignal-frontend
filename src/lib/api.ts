import type {
  AccountInfo,
  AuthResponse,
  BillingPlan,
  DashboardData,
  HistoryPage,
  JournalData,
  PublicTrackRecord,
  UserTrade,
  MarketEvent,
  PairCode,
  PerformanceSummary,
  User,
  WeeklyOutlook,
} from './types';

export const API_BASE =
  import.meta.env.VITE_API_URL ?? 'http://localhost:4004/api';

const TOKEN_KEY = 'fxsignal_token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Private mode: the session lasts for this tab only.
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nothing stored.
  }
}

/** Thrown for any non-2xx response; `status` lets callers branch (401 → sign out). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

let onUnauthorized: (() => void) | null = null;

/** The auth provider registers a handler so an expired token signs the user out everywhere. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** Auth endpoints report 401 as "wrong password", not as an expired session. */
  authRequest?: boolean;
}

async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const token = getToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      signal: options.signal,
      headers: {
        ...(options.body !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError')
      throw error;
    throw new ApiError(
      'Cannot reach the FXSignal API. Check that the backend is running.',
      0
    );
  }

  if (response.status === 204) return undefined as T;
  const data = (await response.json().catch(() => null)) as
    (T & { error?: string }) | null;

  if (!response.ok) {
    if (response.status === 401 && !options.authRequest) onUnauthorized?.();
    throw new ApiError(
      data?.error ??
        (response.status === 429
          ? 'Too many requests. Wait a moment and try again.'
          : 'Something went wrong. Please try again.'),
      response.status
    );
  }
  return data as T;
}

// ---- Auth ------------------------------------------------------------------

export const authApi = {
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
      authRequest: true,
    }),
  register: (name: string, email: string, password: string) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: { name, email, password },
      authRequest: true,
    }),
  logout: () =>
    request<void>('/auth/logout', { method: 'POST', authRequest: true }),
  me: (signal?: AbortSignal) => request<{ user: User }>('/auth/me', { signal }),
  updateProfile: (name: string) =>
    request<AuthResponse>('/auth/me', { method: 'PATCH', body: { name } }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>('/auth/password', {
      method: 'POST',
      body: { currentPassword, newPassword },
      authRequest: true,
    }),
};

// ---- Market data -----------------------------------------------------------

export function getDashboard(signal?: AbortSignal, refresh = false) {
  return request<DashboardData>(`/dashboard${refresh ? '?refresh=1' : ''}`, {
    signal,
  });
}

export interface HistoryQuery {
  pair?: PairCode;
  session?: string;
  days?: number;
  limit?: number;
}

export function getHistory(query: HistoryQuery = {}, signal?: AbortSignal) {
  const params = new URLSearchParams();
  if (query.pair) params.set('pair', query.pair);
  if (query.session) params.set('session', query.session);
  if (query.days) params.set('days', String(query.days));
  if (query.limit) params.set('limit', String(query.limit));
  const qs = params.toString();
  return request<HistoryPage>(`/history${qs ? `?${qs}` : ''}`, { signal });
}

export function getPerformance(days = 365, signal?: AbortSignal) {
  return request<PerformanceSummary>(`/history/performance?days=${days}`, {
    signal,
  });
}

export function getEvents(signal?: AbortSignal) {
  return request<MarketEvent[]>('/events', { signal });
}

export function getWeeklyOutlook(signal?: AbortSignal) {
  return request<WeeklyOutlook[]>('/outlook/weekly', { signal });
}

export type ChartTimeframe =
  'M15' | 'H1' | 'H4' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface CandleSeries {
  pair: PairCode;
  timeframe: ChartTimeframe;
  /** Unix seconds, oldest first. */
  candles: {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
  }[];
  asOf: string | null;
}

// Candles change at most every few minutes; share one response per series
// between every chart on the page for a minute.
const candleCache = new Map<
  string,
  { at: number; value: Promise<CandleSeries> }
>();

export function getCandles(pair: PairCode, timeframe: ChartTimeframe) {
  const key = `${pair}:${timeframe}`;
  const hit = candleCache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  const value = request<CandleSeries>(
    `/candles?pair=${encodeURIComponent(pair)}&timeframe=${timeframe}`
  );
  candleCache.set(key, { at: Date.now(), value });
  value.catch(() => candleCache.delete(key));
  return value;
}

// ---- Personal journal -------------------------------------------------------

export interface TradeInput {
  side?: 'LONG' | 'SHORT';
  entryPrice?: number | null;
  exitPrice?: number | null;
  lots?: number | null;
  notes?: string | null;
}

export const journalApi = {
  list: (signal?: AbortSignal) => request<JournalData>('/journal', { signal }),
  save: (predictionId: string, input: TradeInput) =>
    request<UserTrade>(`/journal/${predictionId}`, {
      method: 'PUT',
      body: input,
    }),
  remove: (predictionId: string) =>
    request<void>(`/journal/${predictionId}`, { method: 'DELETE' }),
};

// ---- Public -----------------------------------------------------------------

export function getPublicTrackRecord(days: number, signal?: AbortSignal) {
  return request<PublicTrackRecord>(`/public/track-record?days=${days}`, {
    signal,
    authRequest: true,
  });
}

// ---- Billing ---------------------------------------------------------------

export function getPlans(signal?: AbortSignal) {
  return request<BillingPlan[]>('/billing/plans', { signal });
}

export function getAccount(signal?: AbortSignal) {
  return request<AccountInfo>('/billing/account', { signal });
}

export function checkoutPlan(plan: 'PRO' | 'FREE') {
  return request<{ user: User; plan: BillingPlan; message: string }>(
    '/billing/checkout',
    { method: 'POST', body: { plan } }
  );
}
