import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { handleApiResponse } from '../utils/apiHandler';
import {
  createProfileLink as createProfileLinkRequest,
  deleteProfileLink as deleteProfileLinkRequest,
  deleteResume as deleteResumeRequest,
  getProfile as getProfileRequest,
  replaceResume as replaceResumeRequest,
  updateProfile as updateProfileRequest,
  updateProfileLink as updateProfileLinkRequest,
  uploadResume as uploadResumeRequest,
} from '../services/userService';
import {
  APPLICATIONS_ROOT_KEY,
  AUTH_QUERY_KEY,
  CACHE_TIMES,
  PROFILE_QUERY_KEY,
  SAVED_JOBS_KEY,
} from '../services/queryClient';

const fetchProfile = async () => {
  const response = await getProfileRequest();
  const data = handleApiResponse(response);
  return data ?? null;
};

export const useProfile = () => {
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);

  const profileQuery = useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: fetchProfile,
    staleTime: CACHE_TIMES.profile,
    refetchOnWindowFocus: false,
  });

  const refreshProfileCaches = useCallback(
    (profile) => {
      if (profile) {
        queryClient.setQueryData(PROFILE_QUERY_KEY, profile);
        queryClient.setQueryData(AUTH_QUERY_KEY, (current) =>
          current ? { ...current, ...profile } : profile
        );
      }

      queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: APPLICATIONS_ROOT_KEY });
      queryClient.invalidateQueries({ queryKey: SAVED_JOBS_KEY });
    },
    [queryClient]
  );

  const getProfile = useCallback(async () => {
    setError(null);
    try {
      const data = await queryClient.fetchQuery({
        queryKey: PROFILE_QUERY_KEY,
        queryFn: fetchProfile,
        staleTime: CACHE_TIMES.profile,
      });
      return { data, error: null };
    } catch (err) {
      const message = 'Failed to load profile';
      setError(message);
      return { data: null, error: message, rawError: err };
    }
  }, [queryClient]);

  const updateProfileMutation = useMutation({
    mutationFn: updateProfileRequest,
    onSuccess: (response) => refreshProfileCaches(handleApiResponse(response)),
  });
  const createProfileLinkMutation = useMutation({
    mutationFn: createProfileLinkRequest,
    onSuccess: () => refreshProfileCaches(),
  });
  const updateProfileLinkMutation = useMutation({
    mutationFn: ({ linkId, payload }) => updateProfileLinkRequest(linkId, payload),
    onSuccess: () => refreshProfileCaches(),
  });
  const deleteProfileLinkMutation = useMutation({
    mutationFn: deleteProfileLinkRequest,
    onSuccess: () => refreshProfileCaches(),
  });
  const uploadResumeMutation = useMutation({
    mutationFn: uploadResumeRequest,
    onSuccess: () => refreshProfileCaches(),
  });
  const replaceResumeMutation = useMutation({
    mutationFn: ({ resumeId, file }) => replaceResumeRequest(resumeId, file),
    onSuccess: () => refreshProfileCaches(),
  });
  const deleteResumeMutation = useMutation({
    mutationFn: deleteResumeRequest,
    onSuccess: () => refreshProfileCaches(),
  });

  const updateProfile = useCallback(
    (payload) => updateProfileMutation.mutateAsync(payload),
    [updateProfileMutation]
  );
  const createProfileLink = useCallback(
    (payload) => createProfileLinkMutation.mutateAsync(payload),
    [createProfileLinkMutation]
  );
  const updateProfileLink = useCallback(
    (linkId, payload) => updateProfileLinkMutation.mutateAsync({ linkId, payload }),
    [updateProfileLinkMutation]
  );
  const deleteProfileLink = useCallback(
    (linkId) => deleteProfileLinkMutation.mutateAsync(linkId),
    [deleteProfileLinkMutation]
  );
  const uploadResume = useCallback(
    (file) => uploadResumeMutation.mutateAsync(file),
    [uploadResumeMutation]
  );
  const replaceResume = useCallback(
    (resumeId, file) => replaceResumeMutation.mutateAsync({ resumeId, file }),
    [replaceResumeMutation]
  );
  const deleteResume = useCallback(
    (resumeId) => deleteResumeMutation.mutateAsync(resumeId),
    [deleteResumeMutation]
  );

  return {
    profile: profileQuery.data || null,
    loading: profileQuery.isLoading,
    fetching: profileQuery.isFetching,
    error: error || (profileQuery.error ? 'Failed to load profile' : null),
    getProfile,
    updateProfile,
    createProfileLink,
    updateProfileLink,
    deleteProfileLink,
    uploadResume,
    replaceResume,
    deleteResume,
  };
};
