import { useCallback, useState, useEffect } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { getClosedJobs } from '../services/jobService';
import { handleApiResponse } from '../utils/apiHandler';
import { getErrorMessage } from '../services/api';
import { CACHE_TIMES } from '../services/queryClient';

const closedJobsKey = (queryString = '') => ['closed-jobs', queryString];

const normalizeJobsResponse = (payload) => {
  const data = payload?.data ?? payload ?? {};
  const items = Array.isArray(data) ? data : data.items || [];

  return {
    items,
    pagination: Array.isArray(data) ? null : data.pagination || null,
  };
};

const fetchClosedJobsByQuery = async (queryString = '') => {
  const response = await getClosedJobs(queryString);
  const data = handleApiResponse(response);
  return normalizeJobsResponse(data);
};

export const useClosedJobs = ({ queryString = 'page=1&limit=12', enabled = true } = {}) => {
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);

  const jobsQuery = useQuery({
    queryKey: closedJobsKey(queryString),
    queryFn: () => fetchClosedJobsByQuery(queryString),
    enabled,
    staleTime: CACHE_TIMES.jobs,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: keepPreviousData,
  });

  const pagination = jobsQuery.data?.pagination || null;

  useEffect(() => {
    if (jobsQuery.error) {
      setError(getErrorMessage(jobsQuery.error, 'Failed to load jobs'));
    } else {
      setError(null);
    }
  }, [jobsQuery.error]);

  return {
    jobs: jobsQuery.data?.items || [],
    pagination: jobsQuery.data?.pagination || null,
    loading: jobsQuery.isLoading,
    fetching: jobsQuery.isFetching,
    error: error || (jobsQuery.error ? 'Failed to load jobs' : null),
    refetch: jobsQuery.refetch,
  };
};
