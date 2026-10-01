import React, { useState, useEffect, useRef } from 'react';
import { HiXMark, HiArrowsUpDown } from 'react-icons/hi2';
import { SCHOOLS } from '../../utils/constants';

const MANDATORY_COLUMNS = [
  { id: 'sno', label: 'S.No' },
  { id: 'rollNumber', label: 'Student Roll Number' },
  { id: 'admissionId', label: 'Student Admission ID' },
  { id: 'email', label: 'College Email' },
  { id: 'name', label: 'Student Name' }
];

const OPTIONAL_COLUMNS = [
  { id: 'school', label: 'School' },
  { id: 'graduationYear', label: 'Graduation Year' },
  { id: 'branch', label: 'Branch' },
  { id: 'cgpa', label: 'CGPA' },
  { id: 'tenthPercentage', label: '10th Percentage' },
  { id: 'twelfthPercentage', label: '12th Percentage' },
  { id: 'personalEmail', label: 'Personal Email' },
  { id: 'mobileNumber', label: 'Mobile Number' },
  { id: 'gender', label: 'Gender' },
  { id: 'age', label: 'Age' },
  { id: 'skills', label: 'Skills' },
  { id: 'createdAt', label: 'Created At' }
];

export default function ExportStudentsModal({ isOpen, onClose, onExport, isExporting }) {
  const [selectedSchools, setSelectedSchools] = useState([]);
  const [selectedYears, setSelectedYears] = useState([]);
  const [optionalColumns, setOptionalColumns] = useState(
    OPTIONAL_COLUMNS.map(col => ({ ...col, selected: true }))
  );
  const [draggedCol, setDraggedCol] = useState(null);
  const modalRef = useRef(null);

  // Generating graduation years locally, isolated
  const baseStart = 2026;
  const currentYear = new Date().getFullYear();
  const start = Math.max(baseStart, currentYear);
  const end = start + 10;
  const graduationYears = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  useEffect(() => {
    if (isOpen) {
      setSelectedSchools([]);
      setSelectedYears([]);
      setOptionalColumns(OPTIONAL_COLUMNS.map(col => ({ ...col, selected: true })));
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

  const toggleColumn = (id) => {
    setOptionalColumns(cols => cols.map(col => col.id === id ? { ...col, selected: !col.selected } : col));
  };

  const handleDragStart = (e, col) => {
    setDraggedCol(col);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      if (e.target) e.target.classList.add('opacity-50');
    }, 0);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetCol) => {
    e.preventDefault();
    if (!draggedCol || draggedCol.id === targetCol.id) return;

    setOptionalColumns(cols => {
      const draggedIdx = cols.findIndex(c => c.id === draggedCol.id);
      const targetIdx = cols.findIndex(c => c.id === targetCol.id);

      const newCols = [...cols];
      newCols.splice(draggedIdx, 1);
      newCols.splice(targetIdx, 0, draggedCol);
      return newCols;
    });
  };

  const handleDragEnd = (e) => {
    if (e.target) e.target.classList.remove('opacity-50');
    setDraggedCol(null);
  };

  const handleExportClick = () => {
    const finalColumns = optionalColumns.filter(c => c.selected).map(c => c.id);

    onExport({
      schools: selectedSchools,
      graduationYears: selectedYears,
      selectedColumns: finalColumns
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col my-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 id="modal-title" className="text-xl font-semibold text-slate-800">Export Students</h2>
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Filters */}
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

            {/* Right Column: Column Selector */}
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Columns (Drag to reorder)</h3>

              <div className="mb-4">
                <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">Mandatory Columns (Fixed)</p>
                <div className="space-y-1.5">
                  {MANDATORY_COLUMNS.map(col => (
                    <div key={col.id} className="flex items-center gap-3 px-3 py-2 bg-slate-100/50 border border-slate-200 rounded-lg text-slate-400 select-none">
                      <div className="w-4 h-4 flex-shrink-0" />
                      <input type="checkbox" checked disabled className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 opacity-50" />
                      <span className="text-sm font-medium">{col.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">Optional Columns</p>
                <div className="space-y-1.5">
                  {optionalColumns.map((col) => (
                    <div
                      key={col.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, col)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, col)}
                      onDragEnd={handleDragEnd}
                      className="flex items-center gap-3 px-3 py-2 bg-white border border-slate-200 rounded-lg shadow-sm cursor-grab active:cursor-grabbing hover:border-blue-300 transition-colors"
                    >
                      <HiArrowsUpDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <label className="flex items-center gap-3 flex-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={col.selected}
                          onChange={() => toggleColumn(col.id)}
                          className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                        />
                        <span className={`text-sm select-none ${col.selected ? 'text-slate-800' : 'text-slate-500 line-through decoration-slate-300'}`}>{col.label}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
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
