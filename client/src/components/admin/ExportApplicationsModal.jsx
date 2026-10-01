import React, { useState, useEffect, useRef } from 'react';
import { HiXMark } from 'react-icons/hi2';
import { SCHOOLS } from '../../utils/constants';

export default function ExportApplicationsModal({ isOpen, onClose, onExport, isExporting }) {
  const [selectedSchool, setSelectedSchool] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [status, setStatus] = useState('All');
  const [isAbsentOnly, setIsAbsentOnly] = useState(false);
  const [includePersonalEmail, setIncludePersonalEmail] = useState(false);
  const [includeMobileNumber, setIncludeMobileNumber] = useState(false);
  const [includeSalary, setIncludeSalary] = useState(false);
  const [includeLocation, setIncludeLocation] = useState(false);
  const [includeAppliedDate, setIncludeAppliedDate] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const modalRef = useRef(null);

  const baseStart = 2026;
  const currentYear = new Date().getFullYear();
  const start = Math.max(baseStart, currentYear);
  const end = start + 10;
  const graduationYears = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  useEffect(() => {
    if (isOpen) {
      setSelectedSchool('');
      setSelectedYear('');
      setStatus('All');
      setIsAbsentOnly(false);
      setIncludePersonalEmail(false);
      setIncludeMobileNumber(false);
      setIncludeSalary(false);
      setIncludeLocation(false);
      setIncludeAppliedDate(true);
      setShowConfirmation(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (status !== 'Rejected') {
      setIsAbsentOnly(false);
    }
  }, [status]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isExporting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isExporting, onClose]);

  useEffect(() => {
    if (!isExporting) return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isExporting]);

  if (!isOpen) return null;

  const handleExportClick = () => {
    const payload = {
      schools: selectedSchool ? [selectedSchool] : [],
      graduationYears: selectedYear ? [Number(selectedYear)] : [],
      includePersonalEmail,
      includeMobileNumber,
      includeSalary,
      includeLocation,
      includeAppliedDate
    };

    const statusMap = {
      'All': undefined,
      'In Progress': 'in_progress',
      'Selected': 'selected',
      'Rejected': 'rejected'
    };

    if (status !== 'All') {
      payload.status = statusMap[status];
      if (payload.status === 'rejected' && isAbsentOnly) {
        payload.isAbsentOnly = true;
      }
    }

    onExport(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
      <div
        ref={modalRef}
        className="bg-slate-50 rounded-2xl shadow-xl w-full max-w-md flex flex-col my-auto border border-slate-200/60"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="px-6 py-4 border-b border-slate-200/60 flex items-center justify-between rounded-t-2xl">
          <h2 id="modal-title" className="text-xl font-semibold text-slate-800">Export Applications</h2>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <HiXMark className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-5 min-h-[200px] flex flex-col justify-center">
          {!showConfirmation ? (
            <>
              <div>
                <label htmlFor="school-select" className="block text-sm font-bold text-slate-800 mb-2 tracking-wide">School</label>
                <select
                  id="school-select"
                  value={selectedSchool}
                  onChange={(e) => setSelectedSchool(e.target.value)}
                  className={`w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer shadow-sm hover:border-blue-300 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 ${selectedSchool ? 'text-slate-900' : 'text-slate-500'}`}
                >
                  <option value="" disabled className="text-slate-500">Choose School</option>
                  {SCHOOLS.map(school => (
                    <option key={school} value={school} className="text-slate-900 font-medium">{school}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="year-select" className="block text-sm font-bold text-slate-800 mb-2 tracking-wide">Graduation Year</label>
                <select
                  id="year-select"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className={`w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer shadow-sm hover:border-blue-300 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 ${selectedYear ? 'text-slate-900' : 'text-slate-500'}`}
                >
                  <option value="" disabled className="text-slate-500">Choose Graduation Year</option>
                  {graduationYears.map(year => (
                    <option key={year} value={year} className="text-slate-900 font-medium">{year}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="status-select" className="block text-sm font-bold text-slate-800 mb-2 tracking-wide">Application Status</label>
                <select
                  id="status-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={`w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer shadow-sm hover:border-blue-300 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-slate-900`}
                >
                  <option value="All">All</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Selected">Selected</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              {status === 'Rejected' && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="absent-check"
                    checked={isAbsentOnly}
                    onChange={(e) => setIsAbsentOnly(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="absent-check" className="text-sm font-medium text-slate-700 cursor-pointer">Absent Only</label>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-2 tracking-wide">Optional Student Columns</label>
                <div className="flex flex-col gap-3 p-3 mb-4 border border-slate-200 rounded-xl bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="col-personal-email"
                      checked={includePersonalEmail}
                      onChange={(e) => setIncludePersonalEmail(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="col-personal-email" className="text-sm font-medium text-slate-700 cursor-pointer">Personal Email</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="col-mobile"
                      checked={includeMobileNumber}
                      onChange={(e) => setIncludeMobileNumber(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="col-mobile" className="text-sm font-medium text-slate-700 cursor-pointer">Mobile Number</label>
                  </div>
                </div>

                <label className="block text-sm font-bold text-slate-800 mb-2 tracking-wide">Optional Application Columns</label>
                <div className="flex flex-col gap-3 p-3 border border-slate-200 rounded-xl bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="col-salary"
                      checked={includeSalary}
                      onChange={(e) => setIncludeSalary(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="col-salary" className="text-sm font-medium text-slate-700 cursor-pointer">Salary Package</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="col-location"
                      checked={includeLocation}
                      onChange={(e) => setIncludeLocation(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="col-location" className="text-sm font-medium text-slate-700 cursor-pointer">Job Location</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="col-date"
                      checked={includeAppliedDate}
                      onChange={(e) => setIncludeAppliedDate(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="col-date" className="text-sm font-medium text-slate-700 cursor-pointer">Applied Date (IST)</label>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-slate-700 mt-2">
              <p className="font-bold mb-6 text-xl text-slate-800 tracking-tight">
                {isExporting ? 'Generating Application History Report...' : 'Generate Application History Report?'}
              </p>
              <div className="bg-white p-5 rounded-xl border border-slate-200/80 mb-6 shadow-sm space-y-4">
                <div className="flex items-center gap-4 pb-3 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider w-36">School</span>
                  <span className="text-sm font-bold text-slate-900">{selectedSchool}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider w-36">Graduation Year</span>
                  <span className="text-sm font-bold text-slate-900">{selectedYear}</span>
                </div>
                {status !== 'All' && (
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider w-36">Status Filter</span>
                    <span className="text-sm font-bold text-slate-900">
                      {status} {isAbsentOnly ? '(Absent Only)' : ''}
                    </span>
                  </div>
                )}
              </div>
              {isExporting && (
                <div className="text-sm text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200 font-medium space-y-1">
                  <p>Large exports may take some time.</p>
                  <p>Please do not refresh or close this tab until the download starts.</p>
                  <p>You may continue working in another browser tab.</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200/60 rounded-b-2xl flex justify-end gap-3">
          <button
            onClick={() => showConfirmation ? setShowConfirmation(false) : onClose()}
            disabled={isExporting}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:ring-2 focus:ring-slate-200 disabled:opacity-50"
          >
            Cancel
          </button>
          {!showConfirmation ? (
            <button
              onClick={() => setShowConfirmation(true)}
              disabled={isExporting || !selectedSchool || !selectedYear}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-70 flex items-center gap-2"
            >
              Export Excel
            </button>
          ) : (
            <button
              onClick={handleExportClick}
              disabled={isExporting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-70 flex items-center gap-2"
            >
              {isExporting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Exporting
                </>
              ) : (
                'Confirm Export'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
