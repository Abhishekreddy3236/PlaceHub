import React, { useState, useRef } from 'react';
import { useJobAttachments, useUploadJobAttachment, useDeleteJobAttachment } from '../../hooks/useJobAttachments';
import { showApiError } from '../../services/api';
import toast from 'react-hot-toast';
import {
  HiOutlineCloudUpload,
  HiOutlineDocumentText,
  HiOutlineDocumentReport,
  HiOutlinePresentationChartBar,
  HiOutlinePhotograph,
  HiOutlineTrash,
  HiOutlineDownload,
  HiOutlineDocument
} from 'react-icons/hi';
import { downloadJobAttachment } from '../../services/jobAttachmentService';

const getFileIcon = (mimeType, extension) => {
  const ext = extension?.toLowerCase() || mimeType?.toLowerCase() || '';
  if (ext.includes('pdf')) return <HiOutlineDocumentText className="text-red-500 w-8 h-8" />;
  if (ext.includes('word') || ext.includes('docx') || ext.includes('doc')) return <HiOutlineDocumentText className="text-blue-600 w-8 h-8" />;
  if (ext.includes('excel') || ext.includes('sheet') || ext.includes('xlsx')) return <HiOutlineDocumentReport className="text-green-600 w-8 h-8" />;
  if (ext.includes('powerpoint') || ext.includes('presentation') || ext.includes('ppt')) return <HiOutlinePresentationChartBar className="text-orange-500 w-8 h-8" />;
  if (ext.includes('image') || ext.includes('jpg') || ext.includes('png') || ext.includes('jpeg')) return <HiOutlinePhotograph className="text-purple-500 w-8 h-8" />;
  return <HiOutlineDocument className="text-slate-500 w-8 h-8" />;
};

const formatSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function JobAttachments({ jobId }) {
  const { data, isLoading } = useJobAttachments(jobId);
  const uploadMutation = useUploadJobAttachment();
  const deleteMutation = useDeleteJobAttachment();
  const fileInputRef = useRef(null);

  const attachments = data?.data || [];
  const [dragActive, setDragActive] = useState(false);

  if (!jobId) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mt-6">
        <div className="text-center p-6 text-sm text-slate-500">
          Save the job first to upload attachments.
        </div>
      </div>
    );
  }

  const handleFile = async (file) => {
    if (!file) return;

    // Validations
    if (attachments.length >= 5) {
      toast.error('Maximum 5 attachments allowed per job.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size must be below 2MB.');
      return;
    }

    const validExtensions = ['.pdf', '.docx', '.xlsx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png'];
    const extension = '.' + file.name.split('.').pop().toLowerCase();

    if (!validExtensions.includes(extension)) {
      toast.error('Unsupported file type.');
      return;
    }

    try {
      await uploadMutation.mutateAsync({ jobId, file });
      toast.success('Attachment uploaded successfully!');
    } catch (err) {
      showApiError(err, 'Upload failed. Please retry.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDelete = async (attachmentId) => {
    if (!window.confirm('Are you sure you want to delete this attachment?')) return;
    try {
      await deleteMutation.mutateAsync({ jobId, attachmentId });
      toast.success('Attachment deleted.');
    } catch (err) {
      showApiError(err, 'Failed to delete attachment.');
    }
  };

  const handleDownload = async (attachmentId) => {
    try {
      const res = await downloadJobAttachment(jobId, attachmentId);
      if (res.data?.data?.downloadUrl) {
        window.location.href = res.data.data.downloadUrl;
      }
    } catch (err) {
      showApiError(err, 'Download failed.');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mt-6">
      <div className="flex justify-between items-end border-b border-slate-100 pb-3 mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Job Attachments</h3>
          <p className="text-sm text-slate-700 mt-0.5">Upload resources for students (e.g. Guidelines, Presentation). Max 5 files, 2MB each.</p>
        </div>
        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
          {attachments.length} / 5
        </span>
      </div>

      <div
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors mb-6 cursor-pointer
          ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100'}
          ${uploadMutation.isPending || attachments.length >= 5 ? 'opacity-50 pointer-events-none' : ''}
        `}
        onDragEnter={onDrag}
        onDragLeave={onDrag}
        onDragOver={onDrag}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <HiOutlineCloudUpload className="mx-auto h-10 w-10 text-slate-400 mb-2" />
        <p className="text-sm text-slate-700 font-medium">
          {uploadMutation.isPending ? 'Uploading...' : 'Click or drag file to this area to upload'}
        </p>
        <p className="text-xs text-slate-500 mt-1">PDF, DOCX, XLSX, PPT, PPTX, JPG, PNG (Max 2MB)</p>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".pdf,.docx,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFile(e.target.files[0]);
            }
          }}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center p-4">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {attachments.map((file) => (
            <div key={file._id} className="flex flex-col border border-slate-200 rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3 mb-4">
                <div className="shrink-0 mt-1">
                  {getFileIcon(file.mimeType, file.originalName)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate" title={file.originalName}>
                    {file.originalName}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatSize(file.size)} • Uploaded {new Date(file.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-auto">
                <button
                  type="button"
                  onClick={() => handleDownload(file._id)}
                  className="flex-1 flex justify-center items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-blue-600 rounded-lg text-sm font-medium transition-colors min-h-[44px]"
                >
                  <HiOutlineDownload className="w-4 h-4" /> Download
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(file._id)}
                  disabled={deleteMutation.isPending}
                  className="flex-1 flex justify-center items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 text-slate-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 min-h-[44px]"
                >
                  <HiOutlineTrash className="w-4 h-4" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {!isLoading && attachments.length === 0 && (
        <div className="text-center p-6 text-sm text-slate-500 border border-slate-200 border-dashed rounded-xl">
          No attachments uploaded yet.
        </div>
      )}
    </div>
  );
}
