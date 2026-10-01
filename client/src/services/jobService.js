import api from './api';

const requireJobId = (jobId) => {
	if (!jobId) {
		throw new Error('Job ID is required');
	}

	return jobId;
};

export const getJobs = (queryParams, options = {}) => {
	const queryString =
		typeof queryParams === 'string' ? queryParams : queryParams?.toString?.() || '';
	return api.get(queryString ? `/jobs?${queryString}` : '/jobs', options);
};

export const getClosedJobs = (queryParams, options = {}) => {
	const queryString =
		typeof queryParams === 'string' ? queryParams : queryParams?.toString?.() || '';
	return api.get(queryString ? `/jobs/closed?${queryString}` : '/jobs/closed', options);
};

export const getJobById = (jobId, options = {}) => api.get(`/jobs/${requireJobId(jobId)}`, options);

export const getJobDetailsContext = (jobId, options = {}) => api.get(`/jobs/${requireJobId(jobId)}/context`, options);

export const getAllJobs = (queryParams = 'page=1&limit=50', options = {}) => getJobs(queryParams, options);

export const createJob = (formData) =>
	api.post('/jobs', formData, {
		headers: { 'Content-Type': 'multipart/form-data' },
	});

export const updateJob = (jobId, formData) =>
	api.put(`/jobs/${jobId}`, formData, {
		headers: { 'Content-Type': 'multipart/form-data' },
	});

export const deleteJob = (jobId) => api.delete(`/jobs/${jobId}`);

export const bulkDeleteJobs = (payload) => api.post('/jobs/bulk-delete', payload);

export const exportJobs = (payload) => api.post('/jobs/export', payload, {
	responseType: 'blob',
	timeout: 120000
});
