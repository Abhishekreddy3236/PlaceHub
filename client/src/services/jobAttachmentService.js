import api from './api';

export const getJobAttachments = (jobId) =>
  api.get(`/jobs/${jobId}/attachments`);

export const getUploadUrl = (jobId, extension) =>
  api.post(`/jobs/${jobId}/attachments/upload-url`, { extension });

export const completeUpload = (jobId, payload) =>
  api.post(`/jobs/${jobId}/attachments/complete`, payload);

export const downloadJobAttachment = (jobId, attachmentId) =>
  api.get(`/jobs/${jobId}/attachments/${attachmentId}/download`);

export const deleteJobAttachment = (jobId, attachmentId) =>
  api.delete(`/jobs/${jobId}/attachments/${attachmentId}`);
