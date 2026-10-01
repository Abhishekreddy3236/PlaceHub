import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getJobAttachments, getUploadUrl, completeUpload, deleteJobAttachment } from '../services/jobAttachmentService';
import axios from 'axios';

export const JOB_ATTACHMENTS_KEY = 'jobAttachments';

export function useJobAttachments(jobId) {
  return useQuery({
    queryKey: [JOB_ATTACHMENTS_KEY, jobId],
    queryFn: async () => {
      if (!jobId) return { data: { data: [] } };
      const response = await getJobAttachments(jobId);
      return response.data;
    },
    enabled: !!jobId,
  });
}

export function useUploadJobAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, file }) => {
      // 1. Get extension
      const extension = '.' + file.name.split('.').pop().toLowerCase();
      
      // 2. Get upload URL
      const urlRes = await getUploadUrl(jobId, extension);
      const { uploadUrl, r2Key } = urlRes.data.data;

      // 3. Upload direct to R2 using raw axios
      await axios.put(uploadUrl, file, {
        withCredentials: false,
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
      });

      // 4. Complete upload
      const completeRes = await completeUpload(jobId, {
        r2Key,
        fileName: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream'
      });

      return completeRes.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [JOB_ATTACHMENTS_KEY, variables.jobId] });
    },
  });
}

export function useDeleteJobAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, attachmentId }) => {
      const response = await deleteJobAttachment(jobId, attachmentId);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [JOB_ATTACHMENTS_KEY, variables.jobId] });
    },
  });
}
