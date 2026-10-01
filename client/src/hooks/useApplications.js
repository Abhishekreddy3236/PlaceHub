import { useCallback } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { handleApiResponse } from '../utils/apiHandler';
import {
  bulkUpdateApplications,

  getApplicants,
  getMyApplications,
  updateApplicationStatus,
} from '../services/applicationService';
import { getErrorMessage } from '../services/api';
import { APPLICATIONS_ROOT_KEY, CACHE_TIMES, DASHBOARD_QUERY_KEY } from '../services/queryClient';

export const APPLICATIONS_PAGE_LIMIT = 20;

const applicationsKey = ({ scope, endpoint, page, limit, search, status }) => [
  'applications',
  scope,
  page,
  limit,
  endpoint || '',
  search || '',
  status || 'all',
];

const DEFAULT_COUNTS = {
  all: 0,
  in_progress: 0,
  selected: 0,
  rejected: 0,
};

const normalizeApplicationsResponse = (payload) => {
  const data = payload?.data ?? payload ?? {};
  const items = Array.isArray(data) ? data : data.items || [];
  const rawCounts = Array.isArray(data) ? null : data.counts;

  const counts = {
    all: Number(rawCounts?.all ?? DEFAULT_COUNTS.all) || 0,
    in_progress: Number(rawCounts?.in_progress ?? DEFAULT_COUNTS.in_progress) || 0,
    selected: Number(rawCounts?.selected ?? DEFAULT_COUNTS.selected) || 0,
    rejected: Number(rawCounts?.rejected ?? DEFAULT_COUNTS.rejected) || 0,
  };

  return {
    items,
    pagination: Array.isArray(data) ? null : data.pagination || null,
    counts,
  };
};

export const useApplications = ({
  scope = 'my',
  endpoint = '',
  page = 1,
  limit = APPLICATIONS_PAGE_LIMIT,
  search = '',
  status = 'all',
  enabled = true,
} = {}) => {
  const queryClient = useQueryClient();
  const isApplicantsView = Boolean(endpoint);

  const applicationsQuery = useQuery({
    queryKey: applicationsKey({ scope, endpoint, page, limit, search, status }),
    queryFn: async ({ signal }) => {
      const params = { page, limit };
      if (search) params.search = search;
      if (status && status !== 'all') params.status = status;
      const response = isApplicantsView
        ? await getApplicants(endpoint, params, signal)
        : await getMyApplications(params, signal);

      return normalizeApplicationsResponse(handleApiResponse(response));
    },
    enabled: enabled && (!isApplicantsView || Boolean(endpoint)),
    staleTime: isApplicantsView ? CACHE_TIMES.applicants : CACHE_TIMES.applications,
    placeholderData: keepPreviousData,
  });

  const updateStatus = useCallback(async (applicationId, payload) => {
    try {
      const response = await updateApplicationStatus(applicationId, payload);
      const data = handleApiResponse(response);
      queryClient.invalidateQueries({ queryKey: APPLICATIONS_ROOT_KEY });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
      return { data, error: null };
    } catch (err) {
      const message = getErrorMessage(err, 'Failed to update status');
      return { data: null, error: message, rawError: err };
    }
  }, [queryClient]);

  const bulkUpdate = useCallback(async (payload) => {
    try {
      const response = await bulkUpdateApplications(payload);
      const data = handleApiResponse(response);
      queryClient.invalidateQueries({ queryKey: APPLICATIONS_ROOT_KEY });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
      return { data, error: null };
    } catch (err) {
      const message = getErrorMessage(err, 'Bulk update failed');
      return { error: message, rawError: err };
    }
  }, [queryClient]);



  const loadError = applicationsQuery.error
    ? isApplicantsView
      ? 'Failed to load applicants'
      : 'Failed to load applications'
    : null;

  return {
    applications: applicationsQuery.data?.items || [],
    pagination: applicationsQuery.data?.pagination || null,
    counts: applicationsQuery.data?.counts || DEFAULT_COUNTS,
    loading: applicationsQuery.isLoading,
    fetching: applicationsQuery.isFetching,
    error: loadError,
    rawError: applicationsQuery.error,
    refetch: applicationsQuery.refetch,
    updateStatus,
    bulkUpdate,

  };
};
