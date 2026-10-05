import { useEffect, useState } from 'react';
import { getPerformance } from './api';
import type { PerformanceSummary } from './types';

export function usePerformance(days = 365) {
  const [data, setData] = useState<PerformanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    getPerformance(days, controller.signal)
      .then((summary) => {
        setData(summary);
        setError(null);
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(
            err instanceof Error ? err.message : 'Performance is unavailable.'
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [days]);

  return { data, error, loading };
}
