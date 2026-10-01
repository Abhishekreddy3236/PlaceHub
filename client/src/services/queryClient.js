import { QueryClient } from '@tanstack/react-query';

export const AUTH_QUERY_KEY = ['auth', 'me'];
export const PROFILE_QUERY_KEY = ['profile'];
export const DASHBOARD_QUERY_KEY = ['dashboard'];
export const JOBS_ROOT_KEY = ['jobs'];
export const ADMIN_JOBS_ROOT_KEY = ['admin-jobs'];
export const APPLICATIONS_ROOT_KEY = ['applications'];
export const SAVED_JOBS_KEY = ['saved-jobs'];
export const STUDENTS_ROOT_KEY = ['students'];

export const CACHE_TIMES = {
  auth: 5 * 60 * 1000,
  profile: 10 * 60 * 1000,
  jobs: 2 * 60 * 1000,
  applications: 1 * 60 * 1000,
  applicants: 2 * 60 * 1000,
  adminLists: 1 * 60 * 1000,
  dashboard: 5 * 60 * 1000,
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: CACHE_TIMES.jobs,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (failureCount >= 3) return false;
        
        if (error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError' || error?.name === 'AbortError') {
          return false;
        }

        if (error?.response?.status) {
          const status = error.response.status;
          if ([401, 403, 404, 409, 422].includes(status)) {
            return false;
          }
        }
        return true;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
