import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, getErrorMessage } from '../services/api';
import type { ApiResponse, AuthUser } from '../types';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (code: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    const token = localStorage.getItem('tdcp_access_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get<ApiResponse<{ user: AuthUser }>>('/auth/me');
      setUser(data.data.user);
    } catch {
      setUser(null);
      localStorage.removeItem('tdcp_access_token');
      localStorage.removeItem('tdcp_refresh_token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const login = useCallback(async (username: string, password: string) => {
    const { data } = await api.post<
      ApiResponse<{ accessToken: string; refreshToken: string; user: AuthUser }>
    >('/auth/login', { username, password });
    localStorage.setItem('tdcp_access_token', data.data.accessToken);
    localStorage.setItem('tdcp_refresh_token', data.data.refreshToken);
    setUser(data.data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    localStorage.removeItem('tdcp_access_token');
    localStorage.removeItem('tdcp_refresh_token');
    setUser(null);
  }, []);

  const hasPermission = useCallback(
    (code: string) => {
      if (!user) return false;
      if (user.roleCode === 'SUPER_ADMIN') return true;
      return user.permissions.includes(code);
    },
    [user]
  );

  const value = useMemo(
    () => ({ user, loading, login, logout, hasPermission }),
    [user, loading, login, logout, hasPermission]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { getErrorMessage };
