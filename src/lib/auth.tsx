import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  authApi,
  clearToken,
  getToken,
  setToken,
  setUnauthorizedHandler,
} from './api';
import type { User } from './types';

interface AuthContextValue {
  user: User | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (name: string) => Promise<void>;
  /** Patch the cached user after a server change made elsewhere (plan switch). */
  patchUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(() => Boolean(getToken()));

  useEffect(() => {
    // Any 401 from a data request means the token expired: drop the session.
    setUnauthorizedHandler(() => {
      clearToken();
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    const controller = new AbortController();
    authApi
      .me(controller.signal)
      .then(({ user: me }) => setUser(me))
      .catch((error) => {
        if (controller.signal.aborted) return;
        // Keep the token on a network failure; only a rejected token is cleared
        // (the unauthorized handler already did that).
        void error;
      })
      .finally(() => {
        if (!controller.signal.aborted) setInitializing(false);
      });
    return () => controller.abort();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    setToken(response.token);
    setUser(response.user);
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const response = await authApi.register(name, email, password);
      setToken(response.token);
      setUser(response.user);
    },
    []
  );

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => undefined);
    clearToken();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (name: string) => {
    const response = await authApi.updateProfile(name);
    setToken(response.token);
    setUser(response.user);
  }, []);

  const patchUser = useCallback((patch: Partial<User>) => {
    setUser((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const value = useMemo(
    () => ({
      user,
      initializing,
      login,
      register,
      logout,
      updateProfile,
      patchUser,
    }),
    [user, initializing, login, register, logout, updateProfile, patchUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider.');
  return context;
}
