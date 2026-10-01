import React, { useState } from 'react';
import { useJobAttachments } from '../../hooks/useJobAttachments';
import { showApiError } from '../../services/api';
import { downloadJobAttachment } from '../../services/jobAttachmentService';
import {
  HiOutlineDocumentText,
  HiOutlineDocumentReport,
  HiOutlinePresentationChartBar,
  HiOutlinePhotograph,
  HiOutlineDownload,
  HiOutlineDocument,
  HiOutlineFolderOpen
} from 'react-icons/hi';

const getFileIcon = (mimeType, fileName, iconClass = "w-8 h-8") => {
  const ext = fileName?.toLowerCase() || mimeType?.toLowerCase() || '';
  if (ext.includes('pdf')) return <HiOutlineDocumentText className={`text-red-500 ${iconClass}`} />;
  if (ext.includes('word') || ext.includes('docx') || ext.includes('doc')) return <HiOutlineDocumentText className={`text-blue-600 ${iconClass}`} />;
  if (ext.includes('excel') || ext.includes('sheet') || ext.includes('xlsx')) return <HiOutlineDocumentReport className={`text-green-600 ${iconClass}`} />;
  if (ext.includes('powerpoint') || ext.includes('presentation') || ext.includes('ppt')) return <HiOutlinePresentationChartBar className={`text-orange-500 ${iconClass}`} />;
  if (ext.includes('image') || ext.includes('jpg') || ext.includes('png') || ext.includes('jpeg')) return <HiOutlinePhotograph className={`text-purple-500 ${iconClass}`} />;
  return <HiOutlineDocument className={`text-slate-500 ${iconClass}`} />;
};

const formatSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function JobAttachmentsList({ jobId }) {
  const { data, isLoading } = useJobAttachments(jobId);
  const [downloadingIds, setDownloadingIds] = useState(new Set());
  const [showLoading, setShowLoading] = useState(false);

  React.useEffect(() => {
    let timer;
    if (isLoading) {
      timer = setTimeout(() => setShowLoading(true), 250);
    } else {
      setShowLoading(false);
    }
    return () => clearTimeout(timer);
  }, [isLoading]);

  const attachments = data?.data || [];

  const handleDownload = async (attachmentId) => {
    if (downloadingIds.has(attachmentId)) return;
    
    setDownloadingIds(prev => new Set(prev).add(attachmentId));
    try {
      const res = await downloadJobAttachment(jobId, attachmentId);
      const url = res.data?.data?.downloadUrl;
      if (url) {
        const fetchRes = await fetch(url, { method: 'GET', credentials: 'omit' });
        if (!fetchRes.ok) {
          throw new Error('Download failed');
        }
        const blob = await fetchRes.blob();
        if (!blob || blob.size === 0) {
          throw new Error('Empty file received');
        }
        
        const objectUrl = URL.createObjectURL(blob);
        try {
          const anchor = document.createElement('a');
          anchor.href = objectUrl;
          const attachment = attachments.find(a => a._id === attachmentId);
          anchor.download = attachment?.originalName || 'download';
          anchor.style.display = 'none';
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      }
    } catch (err) {
      showApiError(err, 'Download failed.');
    } finally {
      setDownloadingIds(prev => {
        const next = new Set(prev);
        next.delete(attachmentId);
        return next;
      });
    }
  };

  if (isLoading && showLoading) {
    return (
      <div className="mb-8">
        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
          <HiOutlineFolderOpen className="w-5 h-5 text-slate-500" /> Job Documents
        </h3>
        <div className="h-24 bg-slate-100 animate-pulse rounded-xl"></div>
      </div>
    );
  }

  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <h3 className="text-base font-bold text-slate-800 mb-3 tracking-wide flex items-center gap-2">
        <HiOutlineFolderOpen className="w-5 h-5 text-slate-500" /> Job Documents
      </h3>
      <div className="flex gap-3 pb-3 overflow-x-auto lg:overflow-x-visible lg:flex-wrap snap-x snap-mandatory lg:snap-none">
        {attachments.map((file) => {
          const isDownloading = downloadingIds.has(file._id);
          return (
          <button
            key={file._id}
            type="button"
            onClick={() => handleDownload(file._id)}
            disabled={isDownloading}
            title={`Download ${file.originalName}`}
            aria-label={`Download ${file.originalName}`}
            className={`snap-start shrink-0 w-[200px] sm:w-[220px] flex items-center gap-2.5 p-2 pr-3 border border-slate-200 rounded-lg bg-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-100 text-left group ${isDownloading ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-md hover:border-blue-300 active:scale-[0.98]'}`}
          >
            <div className="shrink-0 bg-slate-50 p-1.5 rounded-md group-hover:bg-blue-50 transition-colors">
              {getFileIcon(file.mimeType, file.originalName, "w-5 h-5")}
            </div>
            <div className="flex flex-col min-w-0 flex-1 mr-2">
              <p className="text-sm font-medium text-slate-700 truncate">
                {file.originalName}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {formatSize(file.size)}
              </p>
            </div>
            {isDownloading ? (
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin ml-auto shrink-0" />
            ) : (
              <HiOutlineDownload className="w-4 h-4 text-slate-400 group-hover:text-blue-600 ml-auto shrink-0" />
            )}
          </button>
        )})}
      </div>
    </div>
  );
}
