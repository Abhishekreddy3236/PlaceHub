import { useState, useRef, useEffect } from 'react';
import { HiXMark, HiArrowUpTray } from 'react-icons/hi2';
import api, { showApiError } from '../../services/api';
import toast from 'react-hot-toast';
import ConfirmModal from './ConfirmModal';

const VALID_OPERATIONS = ['BLOCK', 'UNBLOCK', 'UNBLOCK_AND_DELETE'];
const BLOCK_REASONS = ['None', 'Placed', 'Unauthorised', 'Opted Out', 'Active Backlogs', 'Low CGPA', 'DC', 'Other'];

export default function BlocklistCsvModal({ isOpen, onClose }) {
  const [operation, setOperation] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const [blockReason, setBlockReason] = useState('None');
  const [showConfirm, setShowConfirm] = useState(false);
  const fileInputRef = useRef(null);

  const handleClose = () => {
    if (executing || loading) return;
    setOperation('');
    setFile(null);
    setPreviewData(null);
    setLoading(false);
    setExecuting(false);
    setExecutionResult(null);
    setBlockReason('None');
    setShowConfirm(false);
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        if (!executing && !loading) {
          handleClose();
        }
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, executing, loading]);

  if (!isOpen) return null;

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      toast.error('Only CSV files are allowed');
      return;
    }

    if (selectedFile.size > 3 * 1024 * 1024) {
      toast.error('File size must be less than 3MB');
      return;
    }

    if (!operation || !VALID_OPERATIONS.includes(operation)) {
      toast.error('Please select an operation first');
      return;
    }

    setFile(selectedFile);
    await uploadAndPreview(selectedFile, operation);
  };

  const uploadAndPreview = async (fileToUpload, op) => {
    setLoading(true);
    setPreviewData(null);

    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('operation', op);

    try {
      const response = await api.post('/admin/blocklist/csv/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreviewData(response.data?.data);
      toast.success('CSV parsed successfully');
    } catch (err) {
      showApiError(err, 'Failed to parse CSV');
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!file || executing) return;

    if (operation === 'BLOCK' && !blockReason) {
      toast.error('Block reason is mandatory');
      return;
    }

    if (operation === 'UNBLOCK_AND_DELETE') {
      setShowConfirm(true);
      return;
    }

    executeAction();
  };

  const executeAction = async () => {
    setShowConfirm(false);
    setExecuting(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('operation', operation);
    if (operation === 'BLOCK') {
      formData.append('reason', blockReason);
    }

    try {
      const response = await api.post('/admin/blocklist/csv/execute', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000
      });
      setExecutionResult(response.data?.data);
      toast.success('Execution completed successfully');

    } catch (err) {
      showApiError(err, 'Execution failed');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-0">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={handleClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="csv-modal-title"
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-6xl mx-auto flex flex-col max-h-[95vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h2 id="csv-modal-title" className="text-xl font-semibold text-slate-900">Candidate Blocklist CSV Operations</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={executing || loading}
            aria-label="Close modal"
            className={`p-2 rounded-lg transition-colors ${(executing || loading) ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200'}`}
          >
            <HiXMark className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {executionResult ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                  <span className="text-3xl font-semibold text-slate-700">{executionResult.totalRows}</span>
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1 text-center">Total Rows</span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                  <span className="text-3xl font-semibold text-slate-700">{executionResult.successCount}</span>
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1 text-center">Success</span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                  <span className="text-3xl font-semibold text-slate-700">
                    {(executionResult.alreadyBlockedCount || 0) + (executionResult.alreadyUnblockedCount || 0) + (executionResult.notFoundCount || 0) + (executionResult.duplicateCount || 0)}
                  </span>
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1 text-center">Skipped</span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                  <span className="text-3xl font-semibold text-slate-700">
                    {(executionResult.failedCount || 0) + (executionResult.invalidCount || 0) + (executionResult.internalRejectedCount || 0)}
                  </span>
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1 text-center">Failed</span>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="max-h-[65vh] overflow-y-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-6 py-3 font-medium text-slate-900">Email</th>
                        <th className="px-6 py-3 font-medium text-slate-900">Status</th>
                        <th className="px-6 py-3 font-medium text-slate-900">Message</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(executionResult.results || []).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-6 py-3 text-slate-600 font-medium">{row.email}</td>
                          <td className="px-6 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${['BLOCKED', 'UNBLOCKED', 'DELETED'].includes(row.status) ? 'bg-green-100 text-green-800' :
                              ['ALREADY_BLOCKED', 'ALREADY_UNBLOCKED', 'NOT_FOUND', 'NOT_BLOCKED'].includes(row.status) ? 'bg-amber-100 text-amber-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                              {row.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-slate-500">{row.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <button
                  onClick={handleClose}
                  className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shadow-sm font-medium"
                >
                  Close & Refresh
                </button>
              </div>
            </div>
          ) : !previewData ? (
            <div className="max-w-xl mx-auto space-y-6">

              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-900">Select Operation</label>
                <select
                  value={operation}
                  onChange={(e) => setOperation(e.target.value)}
                  className="w-full h-11 pl-3 pr-8 border border-slate-300 rounded-xl text-sm text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm cursor-pointer"
                  disabled={loading}
                >
                  <option value="" disabled>Select an operation...</option>
                  <option value="BLOCK">Block Candidates</option>
                  <option value="UNBLOCK">Unblock Candidates</option>
                  <option value="UNBLOCK_AND_DELETE">Unblock & Delete Records</option>
                </select>
              </div>

              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${loading ? 'border-blue-300 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50 bg-white'} ${!operation ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  disabled={loading || !operation}
                />

                {loading ? (
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
                    <p className="text-slate-600 font-medium">Parsing CSV securely...</p>
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <HiArrowUpTray className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 mb-1">Select CSV File</h3>
                    <p className="text-sm text-slate-500 mb-6">
                      Only one column required: <strong>email</strong><br />
                      Max 200 rows, up to 3MB
                    </p>
                    <button
                      onClick={() => {
                        if (!operation) {
                          toast.error('Please select an operation first');
                          return;
                        }
                        fileInputRef.current?.click();
                      }}
                      className={`px-4 py-2 bg-blue-600 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-4 focus:ring-blue-100 ${!operation ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'}`}
                    >
                      Browse Files
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                  <span className="text-3xl font-semibold text-slate-700">{previewData.totalRows}</span>
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1 text-center">Total Rows</span>
                </div>

                {operation === 'BLOCK' && (
                  <>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                      <span className="text-3xl font-semibold text-slate-700">{previewData.readyBlockCount}</span>
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1 text-center">Ready To Block</span>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                      <span className="text-3xl font-semibold text-slate-700">{previewData.unknownEmailCount}</span>
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1 text-center">Unknown Emails</span>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                      <span className="text-3xl font-semibold text-slate-700">{previewData.alreadyBlockedCount}</span>
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1 text-center">Already Blocked</span>
                    </div>
                  </>
                )}

                {operation === 'UNBLOCK' && (
                  <>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                      <span className="text-3xl font-semibold text-slate-700">{previewData.readyToUnblockCount}</span>
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1 text-center">Ready To Unblock</span>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                      <span className="text-3xl font-semibold text-slate-700">{previewData.alreadyUnblockedCount}</span>
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1 text-center">Already Unblocked</span>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                      <span className="text-3xl font-semibold text-slate-700">{previewData.notFoundCount}</span>
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1 text-center">Not Found</span>
                    </div>
                  </>
                )}

                {operation === 'UNBLOCK_AND_DELETE' && (
                  <>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                      <span className="text-3xl font-semibold text-slate-700">{previewData.readyToDeleteCount}</span>
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1 text-center">Ready To Delete</span>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                      <span className="text-3xl font-semibold text-slate-700">{previewData.notFoundCount}</span>
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1 text-center">Not Found</span>
                    </div>
                  </>
                )}

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                  <span className="text-3xl font-semibold text-slate-700">
                    {previewData.invalidCount + (previewData.internalRejectedCount || 0)}
                  </span>
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1 text-center">Invalid/Internal</span>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <h3 className="font-medium text-slate-800 mb-3 border-b border-slate-100 pb-2">Preview Valid Emails</h3>
                <div className="max-h-[65vh] overflow-y-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 font-medium text-slate-900">Email</th>
                        <th className="px-4 py-2 font-medium text-slate-900">Admission ID</th>
                        <th className="px-4 py-2 font-medium text-slate-900">School</th>
                        <th className="px-4 py-2 font-medium text-slate-900">Graduation Year</th>
                        <th className="px-4 py-2 font-medium text-slate-900">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {previewData.preview.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-2 text-slate-600">{row.email}</td>
                          <td className="px-4 py-2 text-slate-600">{row.admissionId || 'N/A'}</td>
                          <td className="px-4 py-2 text-slate-600">{row.school || 'N/A'}</td>
                          <td className="px-4 py-2 text-slate-600">{row.graduationYear || 'N/A'}</td>
                          <td className="px-4 py-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${['READY', 'READY_TO_UNBLOCK', 'READY_TO_DELETE'].includes(row.status) ? 'bg-green-100 text-green-800' :
                              ['ALREADY_BLOCKED', 'UNKNOWN', 'NOT_FOUND'].includes(row.status) ? 'bg-amber-100 text-amber-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                              {row.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Actions */}
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex-1 w-full">
                  {operation === 'BLOCK' && (
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-semibold text-slate-700 whitespace-nowrap">Block Reason:</label>
                      <select
                        value={blockReason}
                        onChange={(e) => setBlockReason(e.target.value)}
                        className="w-full max-w-xs h-10 pl-3 pr-8 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
                        disabled={executing}
                      >
                        {BLOCK_REASONS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {operation === 'UNBLOCK_AND_DELETE' && (
                    <div className="text-sm text-red-600 font-medium">
                      ⚠️ This will permanently remove Blocklist records. This action cannot be undone.
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      setFile(null);
                      setPreviewData(null);
                      setExecutionResult(null);
                      setBlockReason('None');
                    }}
                    disabled={executing}
                    className="flex-1 sm:flex-none px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExecute}
                    disabled={executing || (operation === 'BLOCK' && !blockReason)}
                    className="flex-1 sm:flex-none px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]"
                  >
                    {executing ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Confirm & Execute'
                    )}
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
      <ConfirmModal
        open={showConfirm}
        title="Delete Blocklist Records"
        message="This will permanently remove Blocklist records. This action cannot be undone."
        confirmLabel="Yes, Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={executing}
        onConfirm={executeAction}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
