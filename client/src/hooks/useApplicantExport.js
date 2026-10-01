import { useState } from 'react';
import toast from 'react-hot-toast';
import { showApiError } from '../services/api';
import { exportApplicants as exportApplicantsApi } from '../services/applicationService';

export function useApplicantExport() {
  const [isExporting, setIsExporting] = useState(false);

  const exportApplicants = async (jobId, payload, onSuccess) => {
    setIsExporting(true);
    try {
      const response = await exportApplicantsApi(jobId, payload);
      
      // Axios stores headers in lowercase
      const disposition = response.headers['content-disposition'];
      let filename = 'Applicants.xlsx';
      
      if (disposition) {
        // Try to extract UTF-8 filename first (RFC 5987)
        const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
        if (utf8Match && utf8Match[1]) {
          filename = decodeURIComponent(utf8Match[1]);
        } else {
          // Fallback to standard filename="..."
          const match = disposition.match(/filename="([^"]+)"/i);
          if (match && match[1]) {
            filename = match[1];
          }
        }
      }

      // Create blob link to download
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      if (onSuccess) {
        onSuccess();
      }
      toast.success('Export completed successfully');
    } catch (err) {
      showApiError(err, 'Failed to export applicants');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportApplicants, isExporting };
}
