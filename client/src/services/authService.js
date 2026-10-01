import api from './api';

export const requestOtp = (email) => api.post('/auth/request-otp', { email });

export const verifyOtp = (email, otp) => api.post('/auth/verify-otp', { email, otp });

export const registerStudent = (payload) => api.post('/auth/register-student', payload);

export const getRegistrationStatus = () => api.get('/auth/registration-status');
