import api from './api';

export const getDashboardData = (options = {}) => api.get('/dashboard-data', options);
