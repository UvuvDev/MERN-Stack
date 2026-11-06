import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, clearStoredToken, hasSessionHint, setStoredToken } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await authApi.me();
      const nextUser = data && data.user ? data.user : null;
      setUser(nextUser);
      return nextUser;
    } catch (error) {
      if (error && error.status !== 401) {
        // A network outage should not discard a valid-looking session silently;
        // there is no cached profile to restore, so leave the visitor signed out.
      }
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!hasSessionHint()) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    authApi
      .me()
      .then((data) => {
        if (active) setUser(data && data.user ? data.user : null);
      })
      .catch((error) => {
        if (active && (!error || error.status !== 401)) {
          setUser(null);
        } else if (active) {
          setUser(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const data = await authApi.login({ email, password });
    if (data && data.token) {
      setStoredToken(data.token);
    }
    setUser(data && data.user ? data.user : null);
    return data;
  }, []);

  const register = useCallback(async ({ email, password, displayName }) => {
    return authApi.register({ email, password, displayName });
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Signing out locally is still correct if the network or session is gone.
    } finally {
      clearStoredToken();
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refresh,
      isAuthenticated: Boolean(user),
    }),
    [user, loading, login, register, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider.');
  }
  return context;
}
