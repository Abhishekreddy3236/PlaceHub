import React, { useState, useEffect, useRef } from 'react';
import { HiXMark } from 'react-icons/hi2';
import { SCHOOLS, getAllowedYears } from '../../../utils/constants';

export default function ExportJobsModal({ isOpen, onClose, onExport, isExporting }) {
  const [selectedSchools, setSelectedSchools] = useState([]);
  const [selectedYears, setSelectedYears] = useState([]);
  const modalRef = useRef(null);

  const graduationYears = getAllowedYears();

  useEffect(() => {
    if (isOpen) {
      setSelectedSchools([]);
      setSelectedYears([]);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isExporting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isExporting, onClose]);

  if (!isOpen) return null;

  const toggleArrayItem = (array, setArray, item) => {
    if (array.includes(item)) {
      setArray(array.filter(i => i !== item));
    } else {
      setArray([...array, item]);
    }
  };

  const handleExportClick = () => {
    onExport({
      schools: selectedSchools,
      graduationYears: selectedYears,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col my-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 id="modal-title" className="text-xl font-semibold text-slate-800">Export Jobs</h2>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <HiXMark className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-3">School Filter</h3>
              <div className="flex flex-wrap gap-2">
                {SCHOOLS.map(school => (
                  <label key={school} className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedSchools.includes(school)}
                      onChange={() => toggleArrayItem(selectedSchools, setSelectedSchools, school)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">{school}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">Leave all unchecked to export all schools.</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Graduation Year Filter</h3>
              <div className="flex flex-wrap gap-2">
                {graduationYears.map(year => (
                  <label key={year} className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedYears.includes(year)}
                      onChange={() => toggleArrayItem(selectedYears, setSelectedYears, year)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">{year}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">Leave all unchecked to export all graduation years.</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3 sticky bottom-0 z-10">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="px-5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:ring-2 focus:ring-slate-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExportClick}
            disabled={isExporting}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-70 flex items-center gap-2"
          >
            {isExporting ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Exporting...
              </>
            ) : (
              'Export Excel'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
