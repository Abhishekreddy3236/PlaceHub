import api from './api';

export const createHrCredentials = (payload) => api.post('/admin/create-hr', payload);

export const getWhitelistStatus = () => api.get('/admin/whitelist/status');

export const updateConfig = (data) =>
  api.patch('/admin/config', data);

export const uploadWhitelistCsv = (formData) =>
  api.post('/admin/whitelist/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });


export const addManualWhitelist = (email) =>
  api.post('/admin/whitelist/manual-add', { email });

export const removeManualWhitelist = (email) =>
  api.post('/admin/whitelist/manual-remove', { email });

export const getWhitelistDbList = (params) =>
  api.get('/admin/whitelist/db-list', { params });

export const bulkDeleteWhitelistEmails = (emails) =>
  api.delete('/admin/whitelist/bulk-delete', { data: { emails } });

export const exportStudentsExcel = (payload) =>
  api.post('/admin/students/export', payload, { responseType: 'blob' });

export const exportBlocklistExcel = (params) =>
  api.get('/admin/blocklist/export', { params, responseType: 'blob', timeout: 60000 });

export const exportApplicationsExcel = (payload) =>
  api.post('/admin/applications/export', payload, { responseType: 'blob', timeout: 600000 });
