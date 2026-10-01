import { useState, useEffect, useMemo, useRef } from 'react';
import api, { showApiError } from '../../services/api';
import { useStudents } from '../../hooks/useStudents';
import { handleApiResponse } from '../../utils/apiHandler';
import { useQueryClient } from '@tanstack/react-query';
import {
  APPLICATIONS_ROOT_KEY,
  DASHBOARD_QUERY_KEY,
  STUDENTS_ROOT_KEY,
} from '../../services/queryClient';
import { HiOutlineAcademicCap, HiOutlineBriefcase, HiOutlineDocumentText, HiOutlineMail, HiOutlinePencil, HiOutlineTrash, HiOutlineUser, HiOutlineX, HiOutlineDotsVertical, HiOutlineDownload, HiOutlineFilter, HiOutlineCalendar } from 'react-icons/hi';
import toast from 'react-hot-toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import RefreshButton from '../../components/common/RefreshButton';
import { SCHOOLS, getAllowedYears } from '../../utils/constants';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/rbac';
import downloadResume from '../../utils/downloadResume';
import PaginationControls from '../../components/ui/PaginationControls';
import { useBulkOperation } from '../../hooks/useBulkOperation';
import ExportStudentsModal from '../../components/admin/ExportStudentsModal';
import ExportApplicationsModal from '../../components/admin/ExportApplicationsModal';
import { exportStudentsExcel, exportApplicationsExcel } from '../../services/adminService';

const ExportDropdown = ({ onExportStudents, onExportApplications, canReadApplications }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 border border-emerald-600 rounded-lg shadow-sm hover:bg-emerald-700 transition-all whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
      >
        <HiOutlineDownload size={16} />
        Export to Excel
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-2 right-0 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 flex flex-col overflow-hidden">
          <button
            onClick={() => {
              setIsOpen(false);
              onExportStudents();
            }}
            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2 font-medium"
          >
            <HiOutlineDownload size={16} className="text-slate-400" />
            Export Students
          </button>

          {canReadApplications && (
            <button
              onClick={() => {
                setIsOpen(false);
                onExportApplications();
              }}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2 font-medium"
            >
              <HiOutlineDownload size={16} className="text-slate-400" />
              Export Applications
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const StudentFiltersDropdown = ({ schools, setSchools, graduationYears, setGraduationYears, setPage }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempSchools, setTempSchools] = useState([]);
  const [tempGraduationYears, setTempGraduationYears] = useState([]);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTempSchools(schools);
      setTempGraduationYears(graduationYears);
    }
  }, [isOpen, schools, graduationYears]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const totalCount = schools.length + graduationYears.length;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-2 text-sm px-3 py-2 border rounded-lg whitespace-nowrap transition-colors ${totalCount > 0 ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-50'}`}
      >
        <HiOutlineFilter size={16} />
        Filters {totalCount > 0 && `(${totalCount})`}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden ring-1 ring-slate-900/5" ref={dropdownRef}>
            <div className="flex items-center justify-between p-5 sm:px-6 border-b border-slate-100 bg-white">
              <h3 className="text-xl font-semibold text-slate-900 tracking-tight">Filters</h3>
              <div className="flex items-center gap-4">
                {(tempSchools.length > 0 || tempGraduationYears.length > 0) && (
                  <button
                    onClick={() => {
                      setTempSchools([]);
                      setTempGraduationYears([]);
                    }}
                    className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    Clear all
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full transition-colors hover:bg-slate-100 focus:outline-none"
                >
                  <HiOutlineX size={20} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-5 sm:px-6 space-y-8 bg-slate-50/50">
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <h4 className="text-base font-medium text-slate-900">School</h4>
                  {tempSchools.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium ml-2">
                      {tempSchools.length}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SCHOOLS.map((opt) => {
                    const value = String(opt);
                    const isChecked = tempSchools.includes(value);
                    return (
                      <label key={value} className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${isChecked ? 'bg-blue-50/50 border-blue-200 ring-1 ring-blue-500/20' : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const newSelected = isChecked
                              ? tempSchools.filter(s => s !== value)
                              : [...tempSchools, value];
                            setTempSchools(newSelected);
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 transition-colors"
                        />
                        <span className={`text-sm font-medium ${isChecked ? 'text-blue-900' : 'text-slate-700'}`}>{value}</span>
                      </label>
                    );
                  })}
                </div>
              </section>

              <div className="h-px bg-slate-200" />

              <section>
                <div className="flex items-center gap-2 mb-4">
                  <h4 className="text-base font-medium text-slate-900">Graduation Year</h4>
                  {tempGraduationYears.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium ml-2">
                      {tempGraduationYears.length}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  {getAllowedYears().map((opt) => {
                    const value = String(opt);
                    const isChecked = tempGraduationYears.includes(value);
                    return (
                      <label key={value} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all ${isChecked ? 'bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-500/20' : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const newSelected = isChecked
                              ? tempGraduationYears.filter(s => s !== value)
                              : [...tempGraduationYears, value];
                            setTempGraduationYears(newSelected);
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 transition-colors"
                        />
                        <span className={`text-sm font-medium ${isChecked ? 'text-indigo-900' : 'text-slate-700'}`}>{value}</span>
                      </label>
                    );
                  })}
                </div>
              </section>
            </div>

            <div className="p-5 sm:px-6 border-t border-slate-100 bg-white flex justify-end gap-3">
              <button
                onClick={() => setIsOpen(false)}
                className="px-5 py-2.5 text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 font-medium text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setSchools(tempSchools);
                  setGraduationYears(tempGraduationYears);
                  setPage(1);
                  setIsOpen(false);
                }}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium text-sm transition-colors shadow-sm shadow-blue-600/20"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default function AdminStudents() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const searchInputRef = useRef(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [branch, setBranch] = useState('');
  const [minCgpa, setMinCgpa] = useState('');
  const [maxCgpa, setMaxCgpa] = useState('');
  const [schools, setSchools] = useState([]);
  const [graduationYears, setGraduationYears] = useState([]);
  const [editModal, setEditModal] = useState({ open: false, student: null });
  const [editForm, setEditForm] = useState({
    school: '',
    graduationYear: '',
    rollNumber: '',
    admissionId: '',
  });
  const [editSaving, setEditSaving] = useState(false);
  const [confirmUpdate, setConfirmUpdate] = useState(false);
  const [appsModalOpen, setAppsModalOpen] = useState(false);
  const [selectedApps, setSelectedApps] = useState([]);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [appsExportModalOpen, setAppsExportModalOpen] = useState(false);
  const [isAppsExporting, setIsAppsExporting] = useState(false);
  const [downloadingResumes, setDownloadingResumes] = useState({});

  const sortedSchoolsStr = useMemo(() => [...schools].sort().join(','), [schools]);
  const sortedYearsStr = useMemo(() => [...graduationYears].sort().join(','), [graduationYears]);

  const queryParams = useMemo(() => ({
    page,
    limit: 50,
    search: debouncedSearch,
    branch,
    minCgpa,
    maxCgpa,
    schools: sortedSchoolsStr,
    graduationYears: sortedYearsStr,
  }), [page, debouncedSearch, branch, minCgpa, maxCgpa, sortedSchoolsStr, sortedYearsStr]);

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
  } = useStudents(queryParams);

  const students = Array.isArray(data?.students) ? data.students : [];
  const total = typeof data?.total === 'number' ? data.total : 0;
  const limit = typeof data?.limit === 'number' ? data.limit : 50;
  const startIndex = total === 0 ? 0 : (page - 1) * limit + 1;
  const endIndex = total === 0 ? 0 : Math.min(page * limit, total);

  const totalPages =
    typeof data?.total === 'number' && typeof data?.limit === 'number'
      ? Math.ceil(data.total / data.limit)
      : 1;

  useEffect(() => {
    if (typeof totalPages === 'number' && totalPages > 0 && page > totalPages) {
      setPage(totalPages);
    }
  }, [totalPages, page]);

  useEffect(() => {
    setPage(1);
  }, [schools, graduationYears]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setDebouncedSearch(search);
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [debouncedSearch, isFetching]);

  useEffect(() => {
    if (appsModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [appsModalOpen]);

  const filtered = students;

  const [selectedIds, setSelectedIds] = useState([]);
  const [confirmModal, setConfirmModal] = useState({ open: false, type: 'single', id: null });
  const [deleting, setDeleting] = useState(false);
  const canWriteUsers = hasPermission(user, 'users', 'write');
  const canReadApplications = hasPermission(user, 'applications', 'read');
  const [activeMenuId, setActiveMenuId] = useState(null);

  const [operationId, setOperationId] = useState(() => {
    return localStorage.getItem("bulkDeleteOpId");
  });
  const { data: opData } = useBulkOperation(operationId);

  useEffect(() => {
    if (!opData) return;
    if (opData.status === "COMPLETED") {
      localStorage.removeItem("bulkDeleteOpId");
      setOperationId(null);
      alert(`Deleted: ${opData.success}, Failed: ${opData.failed}`);
      queryClient.invalidateQueries({ queryKey: ['students'] });
    } else if (opData.status === "FAILED") {
      localStorage.removeItem("bulkDeleteOpId");
      setOperationId(null);
      alert("Bulk delete failed. Please retry.");
    }
  }, [opData]);

  const normalizeField = (value) => (value && value !== 'N/A' ? value : '');

  const openEditModal = (student) => {
    if (!canWriteUsers) return;

    setEditForm({
      school: normalizeField(student.school),
      graduationYear: normalizeField(student.graduationYear),
      rollNumber: normalizeField(student.rollNumber),
      admissionId: normalizeField(student.admissionId),
    });
    setEditModal({ open: true, student });
  };

  const closeEditModal = () => {
    setEditModal({ open: false, student: null });
    setEditForm({ school: '', graduationYear: '', rollNumber: '', admissionId: '' });
    setConfirmUpdate(false);
  };

  const handleEditChange = (e) => setEditForm({ ...editForm, [e.target.name]: e.target.value });

  const requestUpdateConfirm = () => {
    if (!editForm.school || !editForm.rollNumber || !editForm.admissionId || !editForm.graduationYear) {
      toast.error('Please fill in all required fields');
      return;
    }
    setConfirmUpdate(true);
  };

  const handleUpdateStudent = async () => {
    if (!canWriteUsers) return;
    if (!editModal.student) return;

    const studentId = editModal.student._id;
    const payload = {
      school: editForm.school,
      graduationYear: Number(editForm.graduationYear),
      rollNumber: editForm.rollNumber,
      admissionId: editForm.admissionId,
    };

    setEditSaving(true);
    setConfirmUpdate(false);
    closeEditModal();

    try {
      // 3. Persist to server
      const response = await api.put(`/admin/students/${studentId}`, payload);
      const updated = handleApiResponse(response);

      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: APPLICATIONS_ROOT_KEY });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
      window.dispatchEvent(new CustomEvent('placehub:applicationsChanged'));

      toast.success('Student details updated successfully');
    } catch (error) {
      showApiError(error, 'Failed to update student');
    } finally {
      setEditSaving(false);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filtered.map(s => s._id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleConfirmDelete = async () => {
    if (!canWriteUsers) return;

    setDeleting(true);
    try {
      if (confirmModal.type === 'bulk') {
        const res = await api.post('/admin/students/bulk-delete', {
          ids: selectedIds,
          confirmText: 'DELETE_ALL_USERS_CONFIRM'
        });
        const opId = res.data.operationId || res.data.data?.operationId;
        if (opId) {
          localStorage.setItem("bulkDeleteOpId", opId);
          setOperationId(opId);
        }
        setSelectedIds([]);
        toast.success('Bulk delete started in background');
      } else {
        await api.delete(`/admin/students/${confirmModal.id}`);
        setSelectedIds(prev => prev.filter(i => i !== confirmModal.id));
        toast.success('Student deleted successfully');
      }
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: APPLICATIONS_ROOT_KEY });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
    } catch (error) {
      showApiError(error, 'Failed to delete');
    } finally {
      setDeleting(false);
      setConfirmModal({ open: false, type: 'single', id: null });
    }
  };

  const handleExport = async (payload) => {
    try {
      setIsExporting(true);
      const res = await exportStudentsExcel(payload);
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const contentDisposition = res.headers['content-disposition'];
      let filename = 'PlaceHub_Students.xlsx';
      if (contentDisposition && contentDisposition.includes('filename=')) {
        filename = contentDisposition.split('filename=')[1].replace(/"/g, '');
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);

      setExportModalOpen(false);
      toast.success('Export downloaded successfully');
    } catch (error) {
      showApiError(error, 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleAppsExport = async (payload) => {
    try {
      setIsAppsExporting(true);
      const res = await exportApplicationsExcel(payload);
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const contentDisposition = res.headers['content-disposition'];
      let filename = 'PlaceHub_ApplicationHistory.xlsx';
      if (contentDisposition && contentDisposition.includes('filename=')) {
        filename = contentDisposition.split('filename=')[1].replace(/"/g, '');
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);

      setAppsExportModalOpen(false);
      toast.success('Applications exported successfully');
    } catch (error) {
      showApiError(error, 'Export failed');
    } finally {
      setIsAppsExporting(false);
    }
  };

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-10 text-red-600">
        {error?.message || 'Failed to load students. Please try again.'}
      </div>
    );
  }

  if (!Array.isArray(students)) {
    return <div className="text-center py-10">Invalid data</div>;
  }


  const progress = opData?.total > 0 ? (opData.processed / opData.total) * 100 : 0;

  return (
    <div>
      {opData && opData.status === "IN_PROGRESS" && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm font-medium text-blue-800 mb-2">
            Deleting users... {opData.processed} / {opData.total}
          </p>
          <div className="w-full bg-blue-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <HiOutlineUser className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
              Students
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Showing{' '}
              {total === 0 ? (
                <>
                  <span className="font-medium text-slate-900">0</span> of <span className="font-medium text-slate-900">0</span>
                </>
              ) : (
                <>
                  <span className="font-medium text-slate-900">{startIndex}</span>
                  –
                  <span className="font-medium text-slate-900">{endIndex}</span> of <span className="font-medium text-slate-900">{total}</span>
                </>
              )}{' '}
              student{total === 1 ? '' : 's'}
            </p>
          </div>
          {canWriteUsers && selectedIds.length > 0 && (
            <div className="flex flex-col gap-1">
              <button
                disabled={selectedIds.length > 50}
                onClick={() => setConfirmModal({ open: true, type: 'bulk', id: null })}
                className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors border border-red-200 flex items-center gap-1 w-fit disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-50"
              >
                <HiOutlineTrash size={16} />
                Delete Selected ({selectedIds.length})
              </button>
              {selectedIds.length > 50 && (
                <span className="text-xs text-red-600">
                  Maximum 50 students can be deleted at once. Deselect some students to continue.
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <ExportDropdown
            onExportStudents={() => setExportModalOpen(true)}
            onExportApplications={() => setAppsExportModalOpen(true)}
            canReadApplications={canReadApplications}
          />
          <RefreshButton onClick={() => queryClient.invalidateQueries({ queryKey: ['students'] })} isLoading={isFetching || isLoading} />
          <StudentFiltersDropdown
            schools={schools}
            setSchools={setSchools}
            graduationYears={graduationYears}
            setGraduationYears={setGraduationYears}
            setPage={setPage}
          />
          {canWriteUsers && (
            <label className="flex items-center gap-2 text-sm text-slate-600 bg-white px-3 py-2 border border-slate-300 rounded-lg whitespace-nowrap cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={filtered.length > 0 && filtered.every(s => selectedIds.includes(s._id))}
                onChange={handleSelectAll}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Select Current Page
            </label>
          )}
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search by name, email, roll no, admission ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-72 px-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {isFetching && (
        <div className="flex justify-center py-2">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4 text-slate-400">
            <HiOutlineUser size={24} />
          </div>
          <h3 className="text-slate-900 font-medium mb-1">No students found</h3>
          <p className="text-slate-500 text-sm">Adjust your filters or search criteria to see more results.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((student) => (
            <div
              key={student._id}
              className={`bg-white rounded-xl border ${selectedIds.includes(student._id) ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200'} shadow-sm p-4 hover:shadow-md transition-shadow relative flex flex-col h-full`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-semibold shrink-0 mt-0.5">
                    {student.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-slate-900 break-words">{student.name}</h3>
                    <p className="text-xs text-slate-500 break-words">{student.email}</p>
                  </div>
                </div>
                {canWriteUsers && (
                  <div className="flex items-center gap-1 shrink-0 mt-0.5">
                    <div
                      className="relative flex items-center"
                      onBlur={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget)) {
                          setActiveMenuId(null);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setActiveMenuId(null);
                      }}
                    >
                      <button
                        onClick={() => setActiveMenuId(activeMenuId === student._id ? null : student._id)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                        title="Actions"
                        aria-expanded={activeMenuId === student._id}
                        aria-haspopup="true"
                      >
                        <HiOutlineDotsVertical size={18} />
                      </button>

                      {activeMenuId === student._id && (
                        <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-20">
                          <button
                            onClick={() => {
                              openEditModal(student);
                              setActiveMenuId(null);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 focus:outline-none focus:bg-slate-50"
                          >
                            <HiOutlinePencil size={16} className="text-slate-400" /> Edit Student
                          </button>
                          <button
                            onClick={() => {
                              setConfirmModal({ open: true, type: 'single', id: student._id });
                              setActiveMenuId(null);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 focus:outline-none focus:bg-red-50"
                          >
                            <HiOutlineTrash size={16} className="text-red-500" /> Delete Student
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="pl-1 flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(student._id)}
                        onChange={() => toggleSelect(student._id)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                <div className="flex items-center gap-1.5 text-slate-700">
                  <HiOutlineAcademicCap size={16} className="text-slate-400 flex-shrink-0" />
                  <span className="truncate">{student.branch}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-700">
                  <span className="text-slate-400 font-normal text-xs flex-shrink-0">CGPA</span>
                  <span>{student.cgpa}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-700">
                  <span className="text-slate-400 font-normal text-xs flex-shrink-0">10th</span>
                  <span>{student.tenthPercentage ?? 'N/A'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-700">
                  <span className="text-slate-400 font-normal text-xs flex-shrink-0">12th</span>
                  <span>{student.twelfthPercentage ?? 'N/A'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-700 col-span-2">
                  <HiOutlineMail size={16} className="text-slate-400 flex-shrink-0" />
                  <span className="truncate">{student.personalEmail || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-700">
                  <span className="text-slate-400 font-normal text-xs flex-shrink-0">Mobile</span>
                  <span className="truncate">{student.mobileNumber || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-700">
                  <span className="text-slate-400 font-normal text-xs flex-shrink-0">Gender</span>
                  <span>{student.gender || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-700">
                  <span className="text-slate-400 font-normal text-xs flex-shrink-0">Roll</span>
                  <span className="truncate">{student.rollNumber || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-700">
                  <span className="text-slate-400 font-normal text-xs flex-shrink-0">Grad</span>
                  <span>{student.graduationYear || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-700 col-span-2">
                  <span className="text-slate-400 font-normal text-xs flex-shrink-0">Admission ID</span>
                  <span className="truncate">{student.admissionId || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-700 col-span-2">
                  <span className="text-slate-400 font-normal text-xs flex-shrink-0">School</span>
                  <span className="truncate">{student.school || 'N/A'}</span>
                </div>
                {student.resumeId && (
                  <button
                    type="button"
                    disabled={downloadingResumes[student._id]}
                    onClick={async () => {
                      if (!student.resumeId) return;
                      setDownloadingResumes(prev => ({ ...prev, [student._id]: true }));
                      try {
                        const res = await api.get(`/resumes/${student.resumeId}`);
                        const url = res.data?.data?.resumeUrl || res.data?.resumeUrl;
                        if (url) window.open(url, '_blank');
                      } catch (err) {
                        toast.error('Failed to load resume');
                      } finally {
                        setDownloadingResumes(prev => ({ ...prev, [student._id]: false }));
                      }
                    }}
                    className="col-span-2 inline-flex items-center justify-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {downloadingResumes[student._id] ? (
                      <>
                        <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                        Opening...
                      </>
                    ) : (
                      <>
                        <HiOutlineDocumentText size={16} />
                        View Resume
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Skills */}
              {student.skills.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-normal text-slate-500 mb-1">Skills</p>
                  <div className="flex flex-wrap gap-1">
                    {student.skills.slice(0, 6).map((skill, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full"
                      >
                        {skill}
                      </span>
                    ))}
                    {student.skills.length > 6 && (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
                        +{student.skills.length - 6}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Applied Jobs */}
              <div className="mt-auto pt-2">
                <p className="text-xs font-normal text-slate-500 mb-1 flex items-center gap-1">
                  <HiOutlineBriefcase size={14} />
                  Applied Jobs ({student.applications?.length || 0})
                </p>
                {student.applications?.length === 0 && (
                  <p className="text-xs text-slate-500">No applications</p>
                )}
                {student.applications?.length > 0 && (
                  <>
                    <ul className="space-y-1">
                      {(student.applications?.slice(0, 3) || []).map((app, i) => {
                        const status = String(app.status || '').toLowerCase().trim();
                        const jobTitle = app.job?.title || app.jobTitle || 'Unknown Job';
                        const companyName =
                          app.job?.company?.name ||
                          app.job?.company ||
                          app.company?.name ||
                          app.company ||
                          'Unknown Company';

                        return (
                          <li key={i} className="text-xs text-slate-600 flex items-center gap-1.5 min-w-0" title={`${jobTitle} at ${companyName}`}>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${status === 'selected' ? 'bg-green-500' : status === 'rejected' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                            <span className={`text-xs font-medium flex-shrink-0 ${status === 'selected'
                              ? 'text-green-600'
                              : status === 'rejected'
                                ? 'text-red-600'
                                : 'text-yellow-600'
                              }`}>
                              {status === 'selected'
                                ? 'Selected'
                                : status === 'rejected'
                                  ? 'Rejected'
                                  : 'Pending'}
                            </span>
                            <span className="truncate">
                              <span className="font-medium text-slate-900">{jobTitle}</span> at {companyName}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    {student.applications?.length > 3 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedApps(student.applications);
                          setAppsModalOpen(true);
                        }}
                        className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700"
                      >
                        View All Applications
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <PaginationControls
        pagination={{ currentPage: page, totalPages }}
        onPageChange={setPage}
        disabled={isLoading}
      />

      {appsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAppsModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">All Applied Jobs</h3>
              <button type="button" onClick={() => setAppsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <HiOutlineX size={20} />
              </button>
            </div>
            <ul className="space-y-3">
              {selectedApps.map((app, i) => {
                const status = String(app.status || '').toLowerCase().trim();
                const jobTitle = app.job?.title || app.jobTitle || 'Unknown Job';
                const companyName =
                  app.job?.company?.name ||
                  app.job?.company ||
                  app.company?.name ||
                  app.company ||
                  'Unknown Company';

                return (
                  <li key={i} className="text-sm text-slate-600 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${status === 'selected' ? 'bg-green-500' : status === 'rejected' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                    <span className="font-medium text-slate-900 truncate">{jobTitle}</span>
                    <span className="truncate">at {companyName}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {canWriteUsers && confirmModal.open && (
        <ConfirmDialog
          title={confirmModal.type === 'bulk' ? "Delete Selected Students" : "Delete Student"}
          message="This action will permanently delete the selected student(s) and all their applications. This cannot be undone."
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmModal({ open: false, type: 'single', id: null })}
          isLoading={deleting}
          delay={5}
        />
      )}

      {canWriteUsers && editModal.open && editModal.student && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeEditModal} />
          <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Edit Student</h2>
              <button
                type="button"
                onClick={closeEditModal}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <HiOutlineX size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                requestUpdateConfirm();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">School</label>
                <select
                  name="school"
                  value={editForm.school}
                  onChange={handleEditChange}
                  required
                  className="w-full input text-sm"
                >
                  <option value="" disabled>Select a school</option>
                  {SCHOOLS.map((school) => (
                    <option key={school} value={school}>{school}</option>
                  ))}
                </select>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Graduation Year</label>
                  <input
                    type="number"
                    name="graduationYear"
                    value={editForm.graduationYear}
                    onChange={handleEditChange}
                    required
                    min="1900"
                    max="3000"
                    className="w-full input text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Roll Number</label>
                  <input
                    type="text"
                    name="rollNumber"
                    value={editForm.rollNumber}
                    onChange={handleEditChange}
                    required
                    className="w-full input text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Admission ID</label>
                <input
                  type="text"
                  name="admissionId"
                  value={editForm.admissionId}
                  onChange={handleEditChange}
                  required
                  className="w-full input text-sm"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="flex-1 btn-secondary text-sm py-2.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="flex-1 btn-primary text-sm py-2.5 disabled:opacity-50"
                >
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {canWriteUsers && confirmUpdate && (
        <ConfirmDialog
          title="Update Student Details"
          message="Are you sure you want to update student details? This will permanently overwrite existing data."
          onConfirm={handleUpdateStudent}
          onCancel={() => setConfirmUpdate(false)}
          isLoading={editSaving}
        />
      )}

      <ExportStudentsModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExport={handleExport}
        isExporting={isExporting}
      />

      <ExportApplicationsModal
        isOpen={appsExportModalOpen}
        onClose={() => setAppsExportModalOpen(false)}
        onExport={handleAppsExport}
        isExporting={isAppsExporting}
      />
    </div>
  );
}
