import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { handleApiResponse } from '../utils/apiHandler';
import api, {
  AUTH_STATE_REFRESH_EVENT,
  clearAccessToken,
  requestTokenRefresh,
  resetSessionExpiredFlag,
  getAccessToken,
  setIsLoggingOut as setApiLoggingOut
} from '../services/api';
import { AUTH_QUERY_KEY, CACHE_TIMES } from '../services/queryClient';

const AuthContext = createContext(null);

let logoutHandler = null;

export const setLogoutHandler = (fn) => {
  logoutHandler = fn;
};

export const getLogoutHandler = () => logoutHandler;

const fetchCurrentUser = async () => {
  try {
    const response = await api.get('/auth/me');
    const data = handleApiResponse(response);
    return data?.user ?? data ?? null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const queryClient = useQueryClient();
  const [authReady, setAuthReady] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const hasToken = Boolean(getAccessToken());

  const initAuth = useCallback(async () => {
    setIsRetrying(true);
    try {
      await requestTokenRefresh();

      const response = await api.get('/auth/me');
      const data = handleApiResponse(response);
      const user = data?.user ?? data ?? null;

      queryClient.setQueryData(AUTH_QUERY_KEY, user);
      setNetworkError(false);
    } catch (error) {
      if (error.message === 'Network Error' || error.code === 'ECONNABORTED' || !error.response) {
        setNetworkError(true);
      } else {
        queryClient.setQueryData(AUTH_QUERY_KEY, null);
        setNetworkError(false);
      }
    } finally {
      setIsRetrying(false);
      setAuthReady(true);
    }
  }, [queryClient]);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const authQuery = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: fetchCurrentUser,
    staleTime: CACHE_TIMES.auth,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
    enabled: authReady && !!getAccessToken(),
  });

  const currentUser = authQuery.data || null;

  const checkAuth = useCallback(async (options = {}) => {
    try {
      const data = await queryClient.fetchQuery({
        queryKey: AUTH_QUERY_KEY,
        queryFn: fetchCurrentUser,
        staleTime: options.force ? 0 : CACHE_TIMES.auth,
      });
      return data;
    } catch {
      clearAccessToken();
      queryClient.setQueryData(AUTH_QUERY_KEY, null);
      return null;
    }
  }, [queryClient]);

  const logout = useCallback(async () => {
    setIsLoggingOut(true);
    setApiLoggingOut(true);

    try {
      await api.post('/auth/logout', {}, { skipAuthRefresh: true });
    } catch { }

    // CRITICAL HARD STOP
    clearAccessToken();

    try {
      await queryClient.cancelQueries();
    } catch { }

    queryClient.removeQueries({ queryKey: AUTH_QUERY_KEY });
    queryClient.clear();

    resetSessionExpiredFlag();

    window.location.replace('/login');
    setIsLoggingOut(false);
    setApiLoggingOut(false);
  }, [queryClient]);

  useEffect(() => {
    setLogoutHandler(logout);
    return () => setLogoutHandler(null);
  }, [logout]);

  // SAFE REFRESH LOOP
  useEffect(() => {
    if (!currentUser) return;

    const interval = setInterval(async () => {
      try {
        await requestTokenRefresh();
      } catch {
        clearAccessToken();
      }
    }, 12 * 60 * 1000);

    return () => clearInterval(interval);
  }, [currentUser]);

  // GLOBAL AUTH REFRESH EVENT
  useEffect(() => {
    let refreshing = false;

    const refreshAuthState = async () => {
      if (refreshing) return;
      refreshing = true;

      try {
        await checkAuth({ force: true });
      } finally {
        refreshing = false;
      }
    };

    window.addEventListener(AUTH_STATE_REFRESH_EVENT, refreshAuthState);

    return () => {
      window.removeEventListener(AUTH_STATE_REFRESH_EVENT, refreshAuthState);
    };
  }, [checkAuth]);

  const login = async (identifier, password) => {
    resetSessionExpiredFlag();

    const response = await api.post(
      '/auth/login',
      { identifier, password },
      { skipAuthRefresh: true }
    );

    const data = handleApiResponse(response);
    const user = data?.user || null;

    if (user) {
      queryClient.setQueryData(AUTH_QUERY_KEY, user);
    }

    return {
      ...(data || {}),
      user,
    };
  };

  return (
    <AuthContext.Provider
      value={{
        user: currentUser,
        // React Query v5 keeps `isPending` true for disabled queries; only treat as loading
        // when we *actually* have a token and are still resolving /me.
        loading: !authReady || (hasToken && authQuery.isPending),
        authReady,
        networkError,
        isRetrying,
        retryAuth: initAuth,
        login,
        logout,
        checkAuth,
        isLoggingOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
