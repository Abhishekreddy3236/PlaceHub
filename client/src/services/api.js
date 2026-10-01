import axios from 'axios';
import toast from 'react-hot-toast';
import { getLogoutHandler } from '../context/AuthContext';
import { queryClient } from './queryClient';
import { triggerMaintenanceMode, getMaintenanceStatus, resetMaintenanceMode } from '../utils/maintenanceEvent';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
export const AUTH_STATE_REFRESH_EVENT = 'placehub:auth-state-refresh';

axios.defaults.withCredentials = true;
axios.defaults.timeout = 20000;

let accessToken = null;
let refreshPromise = null;
let isSessionExpiredHandled = false;
let refreshFailed = false;
let isLoggingOut = false;

export const setIsLoggingOut = (loggingOut) => {
  isLoggingOut = loggingOut;
};

export const resetSessionExpiredFlag = () => {
  isSessionExpiredHandled = false;
  refreshFailed = false;
  isLoggingOut = false;
};

const getPayloadData = (payload) => payload?.data ?? payload ?? null;

const hasMustChangePassword = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  return (
    payload.mustChangePassword === true ||
    payload.user?.mustChangePassword === true ||
    payload.data?.mustChangePassword === true ||
    payload.data?.user?.mustChangePassword === true
  );
};

const redirectToPasswordChange = () => {
  if (typeof window === 'undefined') {
    return;
  }

  if (window.location.pathname !== '/change-password') {
    window.location.assign('/change-password');
  }
};

const isAuthRefreshExcluded = (url = '') =>
  [
    '/auth/login',
    '/auth/logout',
    '/auth/refresh-token',
    '/auth/register-student',
    '/auth/register',
    '/auth/request-otp',
    '/auth/verify-otp',
    '/auth/login',
    '/auth/logout',
    '/auth/refresh-token',
    '/auth/register-student',
    '/auth/register-student',
    '/auth/request-otp',
    '/auth/verify-otp',
  ].some((path) => url.includes(path));

const isAuthStateEndpoint = (url = '') =>
  ['/auth/me', '/auth/me'].some((path) => url.includes(path));

const requestAuthStateRefresh = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(AUTH_STATE_REFRESH_EVENT));
};

export const setAccessToken = (token) => {
  accessToken = token || null;
};

export const getAccessToken = () => accessToken;

export const clearAccessToken = () => {
  accessToken = null;
};

export const getResponseData = (response) => {
  const payload = response?.data;
  return payload?.data ?? payload ?? null;
};

const INTERNAL_ERROR_PATTERNS = [
  /\bCastError\b/i,
  /\bE11000\b/i,
  /\bMongo(?:Error|ServerError|NetworkError)?\b/i,
  /\bMongoose\b/i,
  /\bObjectId\b/i,
  /\bBSON\b/i,
  /\bTypeError\b/i,
  /\bReferenceError\b/i,
  /\bSyntaxError\b/i,
  /\bCannot (?:read|set) properties\b/i,
  /\bundefined\b/i,
  /\bat\s+\S+\s+\(/i,
  /\b(?:SELECT|INSERT|UPDATE|DELETE)\b/i,
];

const getSafeServerMessage = (message, fallback) => {
  if (typeof message !== 'string') {
    return fallback;
  }

  const normalized = message.trim();
  if (!normalized || normalized.length > 180) {
    return fallback;
  }

  if (INTERNAL_ERROR_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return fallback;
  }

  return normalized;
};

export const getErrorMessage = (error, fallback = 'Request failed') => {
  if (!error) {
    return fallback;
  }

  // Session expiration is handled globally; suppress downstream messages.
  if (error._sessionExpired) {
    return null;
  }

  if (axios.isCancel(error)) {
    return null;
  }

  if (error.response?.data?.message) {
    return getSafeServerMessage(error.response.data.message, fallback);
  }

  if (error.response) {
    return fallback;
  }

  if (error.code === 'ECONNABORTED' || (error.message && error.message.includes('timeout of'))) {
    return 'The request took longer than expected. Please check your internet connection and try again.';
  }

  if (error.message === 'Network Error') {
    return 'Network error. Please try again after some time.';
  }

  return getSafeServerMessage(error.message, fallback);
};

export const isSessionExpiredError = (error) =>
  Boolean(error && error._sessionExpired);

export const showApiError = (error, fallback = 'Request failed') => {
  if (isSessionExpiredError(error)) {
    return;
  }

  if (axios.isCancel(error)) {
    return;
  }

  if (error?.response?.data instanceof Blob) {
    error.response.data.text()
      .then((text) => {
        try {
          const parsedData = JSON.parse(text);
          const jsonError = {
            ...error,
            response: { ...error.response, data: parsedData },
          };
          const message = getErrorMessage(jsonError, fallback);
          if (message) {
            toast.error(message);
          }
        } catch (e) {
          toast.error(fallback);
        }
      })
      .catch(() => {
        toast.error(fallback);
      });
    return;
  }

  const message = getErrorMessage(error, fallback);
  if (message) {
    toast.error(message);
  }
};

export const requestTokenRefresh = async () => {
  if (isLoggingOut) {
    return Promise.reject(new Error('Skipping token refresh during logout'));
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = api
    .post(
      '/auth/refresh-token',
      {},
      {
        withCredentials: true,
      }
    )
    .then((response) => {
      const data = getPayloadData(response.data);

      if (data?.accessToken) {
        setAccessToken(data.accessToken);
      }

      if (hasMustChangePassword(data)) {
        redirectToPasswordChange();
      }

      return data;
    })
    .catch((error) => {
      if (!axios.isCancel(error)) {
        clearAccessToken();
      }
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

const isPublicRoute = () => {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname;
  return [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/verify-otp',
    '/verify-reset-otp',
    '/admin/login',
    '/admin/forgot-password',
    '/admin/verify-otp',
    '/admin/reset-password',
  ].some((route) => path === route || path.startsWith(route + '/'));
};

const handleSessionExpired = (err) => {
  err._sessionExpired = true;

  if (!isPublicRoute() && !isSessionExpiredHandled) {
    isSessionExpiredHandled = true;

    toast.error('Session expired. Please login again.');

    const logout = getLogoutHandler();
    if (logout) {
      logout();
      return;
    }

    clearAccessToken();
    window.location.replace('/login');
  } else {
    clearAccessToken();
  }
};

const forceLogout = () => {
  refreshFailed = true;

  if (isSessionExpiredHandled) {
    clearAccessToken();
    return;
  }

  isSessionExpiredHandled = true;

  const logout = getLogoutHandler();
  if (logout) {
    logout();
    return;
  }

  clearAccessToken();
  try {
    queryClient.clear();
  } catch {
    // Best-effort cleanup when the query client is unavailable.
  }

  if (typeof window !== 'undefined') {
    window.location.replace('/login');
  }
};

api.interceptors.response.use(
  (response) => {
    if (getMaintenanceStatus()) {
      resetMaintenanceMode();
    }
    const data = response.data;
    const payload = getPayloadData(data);

    if (payload?.accessToken) {
      setAccessToken(payload.accessToken);
    }

    if (hasMustChangePassword(data)) {
      redirectToPasswordChange();
    }

    return {
      ...response,
      data,
    };
  },
  async (error) => {
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }

    if (error.response && error.response.status === 503) {
      triggerMaintenanceMode();
      return Promise.reject(new axios.CanceledError('MAINTENANCE_MODE_ACTIVE'));
    }

    if (hasMustChangePassword(error.response?.data)) {
      redirectToPasswordChange();
    }

    const originalRequest = error.config || {};
    const requestUrl = originalRequest.url || '';
    const shouldSkipRefresh =
      originalRequest.skipAuthRefresh || isAuthRefreshExcluded(requestUrl);

    if (requestUrl.includes('/auth/refresh-token')) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401) {
      // ONLY redirect if user is logged in and token expired
      if (getAccessToken() && !isLoggingOut && !shouldSkipRefresh) {
        if (refreshFailed) {
          forceLogout();
          return Promise.reject(error);
        }

        if (!originalRequest._retry && error.config) {
          originalRequest._retry = true;

          try {
            const data = await requestTokenRefresh();
            const token = data?.accessToken || getAccessToken();

            if (token) {
              originalRequest.headers = {
                ...(originalRequest.headers || {}),
                Authorization: `Bearer ${token}`,
              };
              return api(originalRequest);
            }

            throw error;
          } catch (refreshError) {
            if (axios.isCancel(refreshError)) {
              return Promise.reject(refreshError);
            }
            forceLogout();
            return Promise.reject(refreshError);
          }
        }

        handleSessionExpired(error);
      }
    }

    if (error.response?.status === 403) {
      // DO NOT redirect
      // Let UI handle error
    }

    return Promise.reject(error);
  }
);

export const adminApi = {
  getDashboardStats: () => api.get('/admin/dashboard'),
  getConfig: () => api.get('/admin/config'),
  saveRegistrationConfig: (payload) => api.put('/admin/config', payload),
  updateRegistration: (registrationEnabled) =>
    api.patch('/admin/config/registration', { registrationEnabled }),
  updateDomainRestriction: (domainRestrictionEnabled) =>
    api.patch('/admin/config/domain-toggle', { domainRestrictionEnabled }),
  updateYearRestriction: (yearRestrictionEnabled) =>
    api.patch('/admin/config/year-restriction-toggle', { yearRestrictionEnabled }),
  updateAllowedDomains: (allowedDomains) =>
    api.patch('/admin/config/domains', { allowedDomains }),
  updateAllowedYears: (allowedYears) =>
    api.patch('/admin/config/years', { allowedYears }),
  getStaff: () => api.get('/admin/staff'),
  createStaff: (payload) => api.post('/admin/staff/create', payload),
  updateStaffPermissions: (payload) =>
    api.patch('/admin/staff/permissions', payload),
  resetStaffPassword: (staffId) =>
    api.post('/admin/staff/reset-password', { staffId }),
  updateStaffStatus: (staffId, isActive) =>
    api.patch('/admin/staff/block', { staffId, isActive }),
  deleteStaff: async (staffId, type = 'soft') => {
    const deleteType = type === 'hard' ? 'hard' : 'soft';
    const payload = {
      staffId,
      type: deleteType,
      ...(deleteType === 'hard' ? { confirmation: 'HARD_DELETE_STAFF' } : {}),
    };

    try {
      return await api.delete(`/admin/staff/${staffId}?type=${deleteType}`, {
        data: payload,
      });
    } catch (error) {
      if (error.response?.status !== 404) {
        throw error;
      }

      return api.delete('/admin/staff/delete', {
        data: payload,
      });
    }
  },
};

export default api;
