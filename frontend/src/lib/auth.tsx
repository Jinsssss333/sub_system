import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, One, setUnauthorizedHandler, tokenStore } from '../api/client';
import type { User } from '../api/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  acceptSession: (token: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => Boolean(tokenStore.get()));

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const acceptSession = useCallback(async (token: string) => {
    tokenStore.set(token);
    const me = await api.get<One<User>>('/auth/me');
    setUser(me.data);
    return me.data;
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!tokenStore.get()) return;
    api
      .get<One<User>>('/auth/me')
      .then((me) => setUser(me.data))
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [logout]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.post<One<{ token: string }>>('/auth/login', { email, password });
      queryClient.clear();
      return acceptSession(res.data.token);
    },
    [acceptSession, queryClient],
  );

  const value = useMemo(() => ({ user, loading, login, acceptSession, logout }), [user, loading, login, acceptSession, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

export const homeFor = (role: User['role']) => (role === 'CUSTOMER' ? '/portal' : '/dashboard');
