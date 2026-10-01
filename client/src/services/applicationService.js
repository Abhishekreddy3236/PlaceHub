import api from './api';

const withQuery = (endpoint, params = {}) => {
	const query = new URLSearchParams();

	Object.entries(params).forEach(([key, value]) => {
		if (value !== undefined && value !== null && value !== '') {
			query.set(key, String(value));
		}
	});



	const queryString = query.toString();
	if (!queryString) return endpoint;

	return `${endpoint}${endpoint.includes('?') ? '&' : '?'}${queryString}`;
};

export const getMyApplications = (params = {}, signal) =>
	api.get(withQuery('/applications/my', params), { signal });

export const checkApplication = (jobId) => api.get(`/applications/check/${jobId}`);

export const applyToJob = (jobId) => {
	if (!jobId) {
		return Promise.reject(new Error('Job ID is required'));
	}

	return api.post(`/applications/${jobId}/apply`, {}, { timeout: 30000 });
};

export const getApplicants = (endpoint, params = {}, signal) => api.get(withQuery(endpoint, params), { signal });

export const updateApplicationStatus = (applicationId, payload) =>
	api.put(`/applications/${applicationId}/status`, payload);

export const bulkUpdateApplications = (payload) =>
	api.post('/applications/bulk-update', payload);

export const exportApplicants = async (jobId, payload) => {
	return api.post(`/applications/admin/job/${jobId}/export`, payload, {
		responseType: 'blob'
	});
};

export const markApplicationsAsRead = () => api.patch('/applications/read');
