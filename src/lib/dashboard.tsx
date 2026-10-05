import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ApiError, getDashboard } from './api';
import type { DashboardData } from './types';

interface DashboardContextValue {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  retrying: boolean;
  /** Plain re-read of the stored data (no provider calls). */
  reload: () => Promise<void>;
  /** Asks the backend for a forced provider pass first. Rate-limited server-side. */
  retry: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextValue | undefined>(
  undefined
);

const POLL_MS = 5 * 60_000;

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [retrying, setRetrying] = useState(false);
  const inflight = useRef<AbortController | null>(null);

  const load = useCallback(async (refresh: boolean) => {
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    try {
      const fresh = await getDashboard(controller.signal, refresh);
      setData(fresh);
      setError(null);
      setLastUpdated(Date.now());
    } catch (err) {
      if (controller.signal.aborted) return;
      // Keep the last good data on screen; just report the failure.
      setError(
        err instanceof ApiError
          ? err.message
          : 'The market feed is unavailable.'
      );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  const reload = useCallback(() => load(false), [load]);
  const retry = useCallback(async () => {
    setRetrying(true);
    await load(true);
    setRetrying(false);
  }, [load]);

  useEffect(() => {
    void load(false);
    return () => inflight.current?.abort();
  }, [load]);

  // Poll gently (the read is database-only), and also refetch right after the
  // next signal window or the market open the backend announced.
  const nextRefresh = data?.stats.nextRefresh;
  useEffect(() => {
    const target = nextRefresh ? new Date(nextRefresh).getTime() : NaN;
    const untilWindow = Number.isNaN(target)
      ? POLL_MS
      : target - Date.now() + 90_000;
    const delay = Math.min(POLL_MS, Math.max(15_000, untilWindow));
    const timer = setTimeout(() => void load(false), delay);
    return () => clearTimeout(timer);
  }, [nextRefresh, lastUpdated, load]);

  // Coming back to a stale tab: refresh immediately.
  useEffect(() => {
    const onVisible = () => {
      if (
        document.visibilityState === 'visible' &&
        lastUpdated !== null &&
        Date.now() - lastUpdated > 60_000
      )
        void load(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [lastUpdated, load]);

  const value = useMemo(
    () => ({ data, loading, error, lastUpdated, retrying, reload, retry }),
    [data, loading, error, lastUpdated, retrying, reload, retry]
  );
  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard(): DashboardContextValue {
  const context = useContext(DashboardContext);
  if (!context)
    throw new Error('useDashboard must be used inside a DashboardProvider.');
  return context;
}
