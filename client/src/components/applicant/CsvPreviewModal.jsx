import { useState, useRef, useEffect } from 'react';
import { HiXMark, HiDocumentText, HiCheckCircle, HiExclamationTriangle, HiArrowUpTray } from 'react-icons/hi2';
import api, { showApiError } from '../../services/api';
import toast from 'react-hot-toast';

export default function CsvPreviewModal({ isOpen, onClose, jobId }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const [executionError, setExecutionError] = useState(null);
  const [confirmation, setConfirmation] = useState({ open: false, action: 'next_round', isAbsent: false });
  const fileInputRef = useRef(null);

  const handleClose = () => {
    if (executing || loading) return;
    setFile(null);
    setPreviewData(null);
    setLoading(false);
    setExecuting(false);
    setExecutionResult(null);
    setExecutionError(null);
    setConfirmation({ open: false, action: 'next_round', isAbsent: false });
    onClose();
  };

  const handleReplaceCsv = () => {
    setFile(null);
    setPreviewData(null);
    setExecutionResult(null);
    setExecutionError(null);
    setConfirmation({ open: false, action: 'next_round', isAbsent: false });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
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

    if (!selectedFile.name.toLowerCase().endsWith('.csv') && selectedFile.type !== 'text/csv') {
      toast.error('Only CSV files are allowed');
      return;
    }

    if (selectedFile.size > 3 * 1024 * 1024) {
      toast.error('File size must be less than 3MB');
      return;
    }

    setFile(selectedFile);
    await uploadAndPreview(selectedFile);
  };

  const uploadAndPreview = async (fileToUpload) => {
    setLoading(true);
    setPreviewData(null);

    const formData = new FormData();
    formData.append('file', fileToUpload);
    if (jobId) {
      formData.append('jobId', jobId);
    }

    try {
      const response = await api.post('/applications/csv/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setPreviewData(response.data?.data);
      toast.success('CSV parsed successfully');
    } catch (err) {
      showApiError(err, 'Failed to parse CSV');
      setFile(null); // Reset on failure
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!file || executing) return;
    setExecuting(true);
    setExecutionError(null);
    setConfirmation({ ...confirmation, open: false });

    const formData = new FormData();
    formData.append('file', file);
    if (jobId) {
      formData.append('jobId', jobId);
    }
    formData.append('action', confirmation.action);
    if (confirmation.action === 'reject' && confirmation.isAbsent) {
      formData.append('isAbsent', 'true');
    }

    try {
      const response = await api.post('/applications/csv/execute', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setExecutionResult(response.data?.data);

      if (response.data?.data?.updated === 0) {
        toast.success('Execution finished with no eligible updates');
      } else {
        toast.success('Execution completed successfully');
      }

      window.dispatchEvent(new Event('placehub:applicationsChanged'));
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || 'A network or server error occurred. Please try again.';

      if (status === 409) {
        setExecutionError({
          title: 'Update Conflict',
          message: 'Some applications were modified by another user in the background. Please close this modal, refresh the page, and try again to avoid overwriting newer data.'
        });
      } else if (status === 401 || status === 403) {
        setExecutionError({
          title: 'Authorization Failed',
          message: 'You do not have permission to execute this action. ' + message
        });
      } else {
        setExecutionError({
          title: 'Execution Failed',
          message: message
        });
      }
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
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h2 id="csv-modal-title" className="text-xl font-semibold text-slate-900">Upload CSV</h2>
            <p className="text-sm text-slate-500 mt-1">Preview applicant emails</p>
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
          {!previewData ? (
            <div className="max-w-xl mx-auto">
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${loading ? 'border-blue-300 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50 bg-white'}`}
              >
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  disabled={loading}
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
                      Only one column required: <strong>college_email</strong><br />
                      Max 500 rows, up to 3MB
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      autoFocus
                      className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-4 focus:ring-blue-100"
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
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                  <div className="p-4 flex flex-col items-center justify-center">
                    <span className="text-3xl font-semibold text-slate-800">{previewData.totalRows}</span>
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1 text-center">Total Rows</span>
                  </div>
                  <div className="p-4 flex flex-col items-center justify-center bg-slate-50/30">
                    <span className="text-3xl font-semibold text-slate-800">{previewData.validEmailsCount}</span>
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1 text-center">Valid</span>
                  </div>
                  <div className="p-4 flex flex-col items-center justify-center">
                    <span className="text-3xl font-semibold text-slate-800">{previewData.uniqueValidEmailsCount}</span>
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1 text-center">Unique Valid</span>
                  </div>
                  <div className="p-4 flex flex-col items-center justify-center bg-slate-50/30">
                    <span className={`text-3xl font-semibold ${previewData.invalidEmailsCount > 0 ? 'text-red-600' : 'text-slate-800'}`}>{previewData.invalidEmailsCount}</span>
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1 text-center">Invalid</span>
                  </div>
                  <div className="p-4 flex flex-col items-center justify-center">
                    <span className={`text-3xl font-semibold ${previewData.duplicateEmailsCount > 0 ? 'text-amber-600' : 'text-slate-800'}`}>{previewData.duplicateEmailsCount}</span>
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1 text-center">Duplicates</span>
                  </div>
                </div>
              </div>

              {/* Intelligent Preview Stats */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
                  <h3 className="text-medium font-semibold text-slate-800">Applicant Match Summary</h3>
                </div>

                <div className="p-6">
                  <div className="flex flex-wrap gap-4 mb-8">
                    <div className="flex-1 min-w-[120px] bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                      <div className="text-xs font-medium text-slate-700 uppercase tracking-wider mb-1">Found</div>
                      <div className="text-2xl font-semibold text-slate-900">{previewData.foundCount}</div>
                    </div>
                    <div className="flex-1 min-w-[120px] bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                      <div className="text-xs font-medium text-slate-700 uppercase tracking-wider mb-1">Not Found</div>
                      <div className="text-2xl font-semibold text-slate-500">{previewData.notFoundCount}</div>
                    </div>
                    <div className="flex-1 min-w-[120px] bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                      <div className="text-xs font-medium text-slate-700 uppercase tracking-wider mb-1">Eligible</div>
                      <div className="text-2xl font-semibold text-emerald-600">{previewData.eligibleCount}</div>
                    </div>
                    <div className="flex-1 min-w-[120px] bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                      <div className="text-xs font-medium text-slate-700 uppercase tracking-wider mb-1">Selected</div>
                      <div className="text-2xl font-semibold text-blue-600">{previewData.alreadySelectedCount}</div>
                    </div>
                    <div className="flex-1 min-w-[120px] bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                      <div className="text-xs font-medium text-slate-700 uppercase tracking-wider mb-1">Rejected</div>
                      <div className="text-2xl font-semibold text-red-600">{previewData.alreadyRejectedCount}</div>
                    </div>
                  </div>

                  {/* Round & Status Distribution */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">Round Overview</h4>
                      <div className="bg-slate-50 border border-slate-100 rounded-lg overflow-hidden">
                        <table className="w-full text-sm text-left">
                          <tbody className="divide-y divide-slate-100">
                            {Object.entries(previewData.roundDistribution || {}).map(([round, count]) => (
                              <tr key={round} className="bg-white hover:bg-slate-50/50">
                                <td className="px-4 py-2.5 text-slate-600">{round}</td>
                                <td className="px-4 py-2.5 text-slate-900 font-medium text-right">{count}</td>
                              </tr>
                            ))}
                            {Object.keys(previewData.roundDistribution || {}).length === 0 && (
                              <tr className="bg-white"><td colSpan="2" className="px-4 py-2.5 text-slate-400">None</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">Status Overview</h4>
                      <div className="bg-slate-50 border border-slate-100 rounded-lg overflow-hidden">
                        <table className="w-full text-sm text-left">
                          <tbody className="divide-y divide-slate-100">
                            {Object.entries(previewData.statusDistribution || {}).map(([status, count]) => {
                              const displayStatus = {
                                'in_progress': 'In Progress',
                                'selected': 'Selected',
                                'rejected': 'Rejected'
                              }[status] || status;

                              return (
                                <tr key={status} className="bg-white hover:bg-slate-50/50">
                                  <td className="px-4 py-2.5 text-slate-600">{displayStatus}</td>
                                  <td className="px-4 py-2.5 text-slate-900 font-medium text-right">{count}</td>
                                </tr>
                              );
                            })}
                            {Object.keys(previewData.statusDistribution || {}).length === 0 && (
                              <tr className="bg-white"><td colSpan="2" className="px-4 py-2.5 text-slate-400">None</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
                {previewData.mixedRoundWarning && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2">
                    <HiExclamationTriangle className="w-5 h-5 text-red-600 shrink-0" />
                    <p className="text-sm text-red-800 font-medium">
                      Warning: Mixed Rounds Detected! Applicants belong to different rounds. This operation requires all applicants to be in the same round.
                    </p>
                  </div>
                )}
              </div>

              {/* Emails List */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                  <h3 className="text-medium font-semibold text-slate-800">
                    Email Preview
                  </h3>
                </div>
                {previewData.emails.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
                    <HiDocumentText className="w-10 h-10 text-slate-300 mb-3" />
                    <h4 className="text-sm font-medium text-slate-700">No preview rows available</h4>
                    <p className="text-xs text-slate-500 mt-1">Upload another CSV to continue.</p>
                  </div>
                ) : (
                  <div className="overflow-y-auto max-h-[300px]">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-800 bg-slate-50 sticky top-0 shadow-sm">
                        <tr>
                          <th className="px-8 py-3 font-medium">Check</th>
                          <th className="px-4 py-3 font-medium">Match</th>
                          <th className="px-4 py-3 font-medium">Applicant Email</th>
                          <th className="px-4 py-3 font-medium">Round</th>
                          <th className="px-8 py-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewData.emails.map((item, index) => {
                          const isDuplicate = item.status === 'valid' && previewData.duplicateEmails.includes(item.normalized);

                          return (
                            <tr key={`${item.normalized || item.email}-${index}`} className="hover:bg-slate-50">
                              <td className="px-4 py-3">
                                {item.status === 'invalid' ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                                    <HiExclamationTriangle className="w-3.5 h-3.5" /> Invalid
                                  </span>
                                ) : isDuplicate ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                                    <HiDocumentText className="w-3.5 h-3.5" /> Duplicate
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                                    <HiCheckCircle className="w-3.5 h-3.5" /> Valid
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {item.dbStatus === 'not_found' ? (
                                  <span className="text-xs font-medium text-slate-600">Not Found</span>
                                ) : item.dbStatus === 'found' ? (
                                  <span className="text-xs font-medium text-blue-600">Found</span>
                                ) : (
                                  <span className="text-xs text-slate-300">-</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-slate-600 font-mono text-xs break-all">{item.email}</td>
                              <td className="px-4 py-3 text-slate-900 font-medium text-xs">
                                {item.currentRound ? `Round ${item.currentRound}` : '-'}
                              </td>
                              <td className="px-4 py-3">
                                {item.eligibility === 'eligible' && <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-[10px] font-bold uppercase tracking-wide">Eligible</span>}
                                {item.eligibility === 'already_selected' && <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-[10px] font-bold uppercase tracking-wide">Selected</span>}
                                {item.eligibility === 'already_rejected' && <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-[10px] font-bold uppercase tracking-wide">Rejected</span>}
                                {item.eligibility === 'already_withdrawn' && <span className="px-2 py-1 bg-slate-100 text-slate-800 rounded text-[10px] font-bold uppercase tracking-wide">Withdrawn</span>}
                                {!item.eligibility && <span className="text-slate-300">-</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Execution States */}
              {confirmation.open && !executing && !executionResult && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mt-6">
                  <h4 className="text-lg font-semibold text-slate-900 mb-2">Confirm Execution</h4>
                  <p className="text-slate-600 mb-6 text-sm max-w-2xl">
                    You are about to execute a update for <strong className="text-slate-900">{previewData.eligibleCount} eligible applicants</strong>.
                    <br />
                    <strong className="text-slate-900">{previewData.totalRows - previewData.eligibleCount} applicants</strong> will be skipped.
                    This action cannot be undone.
                  </p>

                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 mb-6">
                    <div className={confirmation.action === 'reject' ? 'mb-4' : 'mb-0'}>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Select Action</label>
                      <select
                        value={confirmation.action}
                        onChange={(e) => setConfirmation({ ...confirmation, action: e.target.value })}
                        className="w-full sm:w-80 bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 outline-none shadow-sm"
                      >
                        <option value="next_round">Move to Next Round / Select</option>
                        <option value="reject">Reject Candidates</option>
                      </select>
                    </div>

                    {confirmation.action === 'reject' && (
                      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-200">
                        <input
                          type="checkbox"
                          id="csv-absent-checkbox"
                          checked={confirmation.isAbsent || false}
                          onChange={(e) => setConfirmation({ ...confirmation, isAbsent: e.target.checked })}
                          className="w-4 h-4 text-red-600 bg-white border-slate-300 rounded focus:ring-red-500 cursor-pointer"
                        />
                        <label htmlFor="csv-absent-checkbox" className="text-sm font-medium text-slate-700 cursor-pointer">
                          Mark all as Absent
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => setConfirmation({ ...confirmation, open: false })}
                      className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                    >
                      Cancel Execution
                    </button>
                    <button
                      onClick={handleExecute}
                      className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-lg transition-colors shadow-sm ${confirmation.action === 'reject'
                        ? 'bg-red-600 hover:bg-red-700 focus:ring-2 focus:ring-red-200'
                        : 'bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-200'
                        }`}
                    >
                      Confirm & Execute
                    </button>
                  </div>
                </div>
              )}

              {executing && (
                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-blue-200 rounded-xl bg-blue-50">
                  <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
                  <h3 className="text-lg font-medium text-slate-900">Executing...</h3>
                  <p className="text-sm text-slate-500 mt-1">Please wait while the update is processed.</p>
                </div>
              )}

              {executionError && !executing && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6 flex flex-col gap-4 shadow-sm animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex gap-3">
                    <HiExclamationTriangle className="w-7 h-7 text-red-600 shrink-0" />
                    <div>
                      <h4 className="text-base font-semibold text-red-900">{executionError.title}</h4>
                      <p className="text-sm text-red-800 mt-1 leading-relaxed">{executionError.message}</p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-2">
                    <button
                      onClick={() => setExecutionError(null)}
                      className="px-4 py-2 text-sm font-medium border border-red-200 text-red-700 bg-white rounded-lg hover:bg-red-50 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                    >
                      Dismiss & Retry
                    </button>
                  </div>
                </div>
              )}

              {executionResult && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex flex-col items-center justify-center p-8 bg-green-50 border border-green-200 rounded-xl shadow-sm">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 ring-4 ring-green-50">
                      <HiCheckCircle className="w-10 h-10 text-green-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-green-900">
                      {executionResult.updated === 0 ? 'No Eligible Updates' : 'Completed Successfully'}
                    </h3>
                    <p className="text-sm text-green-700 mt-2 text-center max-w-md">
                      {executionResult.updated === 0
                        ? 'There were no eligible applicants in the CSV to update. They may have already been processed.'
                        : `Successfully applied ${executionResult.action === 'next_round' ? 'Next Round' : 'Reject'} to ${executionResult.updated} applicant(s).`}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Total Rows</p>
                      <p className="text-2xl font-bold text-slate-900">{previewData.totalRows}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Found</p>
                      <p className="text-2xl font-bold text-blue-600">{previewData.foundCount}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Updated</p>
                      <p className="text-2xl font-bold text-green-600">{executionResult.updated}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Skipped</p>
                      <p className="text-2xl font-bold text-amber-500">
                        {executionResult.skipped + previewData.notFoundCount + previewData.invalidEmailsCount + previewData.duplicateEmailsCount}
                      </p>
                    </div>
                  </div>

                  {(executionResult.skipped > 0 || previewData.notFoundCount > 0 || previewData.invalidEmailsCount > 0 || previewData.duplicateEmailsCount > 0) && (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                        <h4 className="text-sm font-medium text-slate-900">Skipped Summary</h4>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {previewData.notFoundCount > 0 && (
                          <div className="flex justify-between items-center px-5 py-3">
                            <span className="text-sm text-slate-600">Not found in this job</span>
                            <span className="text-sm font-medium text-slate-900">{previewData.notFoundCount}</span>
                          </div>
                        )}
                        {previewData.invalidEmailsCount > 0 && (
                          <div className="flex justify-between items-center px-5 py-3">
                            <span className="text-sm text-slate-600">Invalid emails in CSV</span>
                            <span className="text-sm font-medium text-slate-900">{previewData.invalidEmailsCount}</span>
                          </div>
                        )}
                        {previewData.duplicateEmailsCount > 0 && (
                          <div className="flex justify-between items-center px-5 py-3">
                            <span className="text-sm text-slate-600">Duplicate emails in CSV</span>
                            <span className="text-sm font-medium text-slate-900">{previewData.duplicateEmailsCount}</span>
                          </div>
                        )}
                        {previewData.alreadySelectedCount > 0 && (
                          <div className="flex justify-between items-center px-5 py-3">
                            <span className="text-sm text-slate-600">Already selected</span>
                            <span className="text-sm font-medium text-slate-900">{previewData.alreadySelectedCount}</span>
                          </div>
                        )}
                        {previewData.alreadyRejectedCount > 0 && (
                          <div className="flex justify-between items-center px-5 py-3">
                            <span className="text-sm text-slate-600">Already rejected</span>
                            <span className="text-sm font-medium text-slate-900">{previewData.alreadyRejectedCount}</span>
                          </div>
                        )}
                        {previewData.alreadyWithdrawnCount > 0 && (
                          <div className="flex justify-between items-center px-5 py-3">
                            <span className="text-sm text-slate-600">Withdrawn by student</span>
                            <span className="text-sm font-medium text-slate-900">{previewData.alreadyWithdrawnCount}</span>
                          </div>
                        )}
                        {previewData.mixedRoundWarning && (
                          <div className="flex justify-between items-center px-5 py-3 bg-amber-50/50">
                            <span className="text-sm text-amber-800">Mixed rounds detected (Skipped by backend safety)</span>
                            <span className="text-sm font-medium text-amber-900">Yes</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}


            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 shrink-0">
          {previewData && !executing && !loading && (
            <button
              onClick={handleReplaceCsv}
              className="px-4 py-2 text-sm font-medium border border-slate-200 text-slate-600 bg-white rounded-lg hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200 mr-auto shadow-sm"
            >
              Replace CSV
            </button>
          )}

          <button
            onClick={handleClose}
            disabled={executing || loading}
            className={`px-4 py-2 text-sm font-medium border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200 ${(executing || loading) ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 shadow-sm'
              }`}
          >
            {executionResult ? 'Close' : previewData ? 'Cancel' : 'Cancel'}
          </button>

          {previewData && !executing && !executionResult && !executionError && !confirmation.open && (
            <button
              onClick={() => setConfirmation({ ...confirmation, open: true })}
              disabled={previewData.eligibleCount === 0 || previewData.mixedRoundWarning}
              className={`px-4 py-2 text-sm font-medium border rounded-lg transition-colors focus:outline-none ${previewData.eligibleCount === 0 || previewData.mixedRoundWarning
                ? 'bg-blue-300 text-white border-transparent cursor-not-allowed'
                : 'bg-blue-600 text-white border-transparent hover:bg-blue-700 shadow-sm focus:ring-2 focus:ring-blue-200'
                }`}
            >
              Execute Update
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
