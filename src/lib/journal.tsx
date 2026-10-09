import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { journalApi, type TradeInput } from './api';
import type { JournalData, UserTrade } from './types';

interface JournalContextValue {
  data: JournalData | null;
  error: string | null;
  tradeFor: (predictionId: string) => UserTrade | null;
  save: (predictionId: string, input: TradeInput) => Promise<void>;
  remove: (predictionId: string) => Promise<void>;
  /** Re-read from the server (e.g. after an MT5 sync). */
  reload: () => Promise<void>;
}

const JournalContext = createContext<JournalContextValue | undefined>(
  undefined
);

/** The signed-in user's own trades, shared by every signal view in the app. */
export function JournalProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<JournalData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setData(await journalApi.list(signal));
      setError(null);
    } catch (err) {
      if (signal?.aborted) return;
      setError(
        err instanceof Error ? err.message : 'Your journal is unavailable.'
      );
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // Trades can arrive from MT5 sync at any time: refresh when the tab returns.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  const reload = useCallback(() => load(), [load]);

  const save = useCallback(
    async (predictionId: string, input: TradeInput) => {
      await journalApi.save(predictionId, input);
      // Reload so the summary (net pips, wins) stays server-computed.
      await load();
    },
    [load]
  );

  const remove = useCallback(
    async (predictionId: string) => {
      await journalApi.remove(predictionId);
      await load();
    },
    [load]
  );

  const tradeFor = useCallback(
    (predictionId: string) =>
      data?.trades.find((t) => t.predictionId === predictionId) ?? null,
    [data]
  );

  const value = useMemo(
    () => ({ data, error, tradeFor, save, remove, reload }),
    [data, error, tradeFor, save, remove, reload]
  );
  return (
    <JournalContext.Provider value={value}>{children}</JournalContext.Provider>
  );
}

export function useJournal(): JournalContextValue {
  const context = useContext(JournalContext);
  if (!context)
    throw new Error('useJournal must be used inside a JournalProvider.');
  return context;
}
