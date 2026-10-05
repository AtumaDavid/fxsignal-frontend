import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type TimeZonePref = 'local' | 'utc';

interface Prefs {
  timeZone: TimeZonePref;
}

const PREFS_KEY = 'fxsignal_prefs_v2';
const DEFAULTS: Prefs = { timeZone: 'local' };

function readPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw
      ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) }
      : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

interface PrefsContextValue extends Prefs {
  setTimeZone: (value: TimeZonePref) => void;
}

const PrefsContext = createContext<PrefsContextValue | undefined>(undefined);

/** Per-device display preferences (kept in this browser only). */
export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(readPrefs);

  const setTimeZone = useCallback((timeZone: TimeZonePref) => {
    setPrefs((current) => {
      const next = { ...current, timeZone };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        // Applies for this session only.
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ ...prefs, setTimeZone }),
    [prefs, setTimeZone]
  );
  return (
    <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
  );
}

export function usePrefs(): PrefsContextValue {
  const context = useContext(PrefsContext);
  if (!context)
    throw new Error('usePrefs must be used inside a PrefsProvider.');
  return context;
}
