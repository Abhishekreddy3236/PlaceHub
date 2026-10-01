import api from './api';
import axios from 'axios';
import { handleApiResponse } from '../utils/apiHandler';

const retry = async (fn, retries = 2) => {
  try {
    return await fn();
  } catch (err) {
    if (retries === 0) throw err;
    return retry(fn, retries - 1);
  }
};

const computeFileSha256 = async (file) => {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Secure hashing is not available in this browser');
  }

  const buffer = await file.arrayBuffer();
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const getProfile = (options = {}) => api.get('/users/profile', options);

export const updateProfile = (payload) => api.put('/users/profile', payload);

export const getApplicationReadiness = (options = {}) => api.get('/profile/application-readiness', options);

export const createProfileLink = (payload) => api.post('/profile/link', payload);

export const updateProfileLink = (linkId, payload) =>
  api.put(`/profile/link/${linkId}`, payload);

export const deleteProfileLink = (linkId) => api.delete(`/profile/link/${linkId}`);

export const uploadResume = async (file) => {
  if (!file || file.size === 0) {
    throw new Error('Invalid file');
  }

  const hash = await computeFileSha256(file);
  let uploadUrl, resumeId;

  // 1. Get presigned URL
  const getPresignedUrl = async () => {
    const response = await api.post('/resumes/r2/generate-upload-url');
    const presignRes = handleApiResponse(response);
    if (!presignRes) throw new Error('Invalid API response');
    uploadUrl = presignRes.uploadUrl;
    resumeId = presignRes.id;
  };

  await retry(getPresignedUrl);

  // 2. Upload directly to R2
  const performUpload = async () => {
    try {
      await axios.put(uploadUrl, file, {
        headers: { 'Content-Type': 'application/pdf' },
        withCredentials: false,
        timeout: 60000
      });
    } catch (err) {
      if (err.response?.status === 403) {
        await getPresignedUrl();
        await axios.put(uploadUrl, file, {
          headers: { 'Content-Type': 'application/pdf' },
          withCredentials: false,
          timeout: 60000
        });
      } else {
        throw err;
      }
    }
  };

  await retry(performUpload, 1);

  // 3. Confirm upload
  if (!resumeId) {
    throw new Error('Resume ID missing after upload URL generation');
  }
  return retry(() => api.post('/resumes/r2/confirm-upload', { id: resumeId, hash }));
};

export const replaceResume = async (resumeId, file) => {
  // Use the same flow for replacement
  return uploadResume(file);
};

export const deleteResume = (resumeId) => api.delete(`/users/resumes/${resumeId}`);

export const getResumeUrl = async (resumeId) => {
  const res = await api.get(`/resumes/${resumeId}`);
  return handleApiResponse(res).resumeUrl;
};
