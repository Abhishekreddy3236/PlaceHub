import api from './api';

export const getSavedJobs = (params) => api.get('/saved-jobs', { params });

export const checkSavedJob = (jobId) => api.get(`/saved-jobs/check/${jobId}`);

export const saveJob = (jobId) => api.post(`/saved-jobs/${jobId}`);

export const unsaveJob = (jobId) => api.delete(`/saved-jobs/${jobId}`);
