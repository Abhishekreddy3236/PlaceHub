import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { createHrCredentials } from '../../services/adminService';
import { bulkDeleteJobs, deleteJob, getAllJobs, exportJobs } from '../../services/jobService';
import ExportJobsModal from '../../components/admin/jobs/ExportJobsModal';
import PageSkeleton from '../../components/PageSkeleton';
import toast from 'react-hot-toast';
import { showApiError, isSessionExpiredError } from '../../services/api';
import { HiOutlinePencil, HiOutlineTrash, HiOutlineUsers, HiOutlineOfficeBuilding, HiOutlineBriefcase, HiOutlineFilter } from 'react-icons/hi';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import DeliveryEmailModal from '../../components/admin/DeliveryEmailModal';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/rbac';
import { handleApiResponse } from '../../utils/apiHandler';
import { CACHE_TIMES, ADMIN_JOBS_ROOT_KEY, JOBS_ROOT_KEY, APPLICATIONS_ROOT_KEY, DASHBOARD_QUERY_KEY, SAVED_JOBS_KEY } from '../../services/queryClient';
import PaginationControls from '../../components/ui/PaginationControls';
import { SCHOOLS, getAllowedYears } from '../../utils/constants';
import { formatDate } from '../../utils/dateFormatter';

const FilterDropdown = ({ label, options, selected, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 text-sm px-3 py-2 border rounded-lg whitespace-nowrap transition-colors ${selected.length > 0 ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-50'}`}
      >
        <HiOutlineFilter size={16} />
        {label} {selected.length > 0 && `(${selected.length})`}
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          <div className="p-2 space-y-1">
            {options.map((opt) => {
              const value = String(typeof opt === 'object' ? opt.value : opt);
              const display = typeof opt === 'object' ? opt.label : String(opt);
              const isChecked = selected.includes(value);
              return (
                <label key={value} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {
                      const newSelected = isChecked
                        ? selected.filter(s => s !== value)
                        : [...selected, value];
                      onChange(newSelected);
                    }}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="truncate">{display}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const EligibilityDisplay = ({ items, label }) => {
  const arr = Array.isArray(items) ? items : [];
  if (arr.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-sm">
        <span className="text-slate-500">{label}:</span>
        <span className="font-medium text-slate-600">All</span>
      </div>
    );
  }

  const visible = arr.slice(0, 2);
  const hidden = arr.length - 2;

  return (
    <div className="flex flex-wrap items-center text-sm">
      <span className="text-slate-500 mr-1.5">{label}:</span>
      {visible.map((item, index) => (
        <span key={index} className="flex items-center font-medium text-slate-600">
          <span className="truncate max-w-[120px] sm:max-w-[200px]" title={String(item)}>
            {String(item)}
          </span>
          {(index < visible.length - 1 || hidden > 0) && (
            <span className="mr-1.5 text-slate-500 font-normal">,</span>
          )}
        </span>
      ))}
      {hidden > 0 && (
        <span className="flex items-center font-medium text-slate-600">
          <span title={`${hidden} more`}>+{hidden}</span>
        </span>
      )}
    </div>
  );
};


const JOBS_PAGE_LIMIT = 50;

const fetchAdminJobs = async ({ page, limit, search, school, graduationYear }) => {
  let query = `page=${page}&limit=${limit}`;
  if (search) query += `&search=${encodeURIComponent(search)}`;
  if (school) query += `&school=${encodeURIComponent(school)}`;
  if (graduationYear) query += `&graduationYear=${encodeURIComponent(graduationYear)}`;
  const response = await getAllJobs(query);
  const data = handleApiResponse(response);
  const items = Array.isArray(data) ? data : data?.items || [];
  const pagination = Array.isArray(data) ? null : data?.pagination || null;
  return { items, pagination };
};

export default function ManageJobs() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Math.max(1, parseInt(searchParams.get('page')) || 1);
  const debouncedSearch = searchParams.get('search') || '';
  const schoolParam = searchParams.get('school') || '';
  const graduationYearParam = searchParams.get('graduationYear') || '';

  const selectedSchools = useMemo(() => schoolParam ? schoolParam.split(',').filter(Boolean) : [], [schoolParam]);
  const selectedYears = useMemo(() => graduationYearParam ? graduationYearParam.split(',').filter(Boolean) : [], [graduationYearParam]);
  const sortedSchoolsStr = useMemo(() => [...selectedSchools].sort().join(','), [selectedSchools]);
  const sortedYearsStr = useMemo(() => [...selectedYears].sort().join(','), [selectedYears]);

  const handleFilterChange = (key, values) => {
    setSearchParams(prev => {
      prev.delete('page');
      if (values.length > 0) prev.set(key, values.join(','));
      else prev.delete(key);
      return prev;
    });
  };

  const [creatingHrId, setCreatingHrId] = useState(null);
  const [searchQuery, setSearchQuery] = useState(debouncedSearch);
  const lastPushedSearch = useRef(debouncedSearch);
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirmModal, setConfirmModal] = useState({ open: false, type: 'single', id: null });
  const [credentialModal, setCredentialModal] = useState({ open: false, job: null });
  const [deleting, setDeleting] = useState(false);
  const canWriteJobs = hasPermission(user, 'jobs', 'write');
  const canReadJobs = hasPermission(user, 'jobs', 'read');
  const canReadApplications = hasPermission(user, 'applications', 'read');
  const canManageHR = hasPermission(user, 'accessControl', 'write');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const setPage = (newPage) => {
    setSearchParams(prev => {
      if (newPage <= 1) prev.delete('page');
      else prev.set('page', newPage);
      return prev;
    });
  };

  const {
    data: queryData,
    isLoading: loading,
    isFetching: fetching,
    error: queryError,
  } = useQuery({
    queryKey: ['admin-jobs', page, debouncedSearch, sortedSchoolsStr, sortedYearsStr],
    queryFn: () => fetchAdminJobs({ page, limit: JOBS_PAGE_LIMIT, search: debouncedSearch, school: sortedSchoolsStr, graduationYear: sortedYearsStr }),
    staleTime: CACHE_TIMES.jobs,
    placeholderData: keepPreviousData,
  });

  const jobs = queryData?.items || [];
  const pagination = queryData?.pagination || null;
  const total = typeof pagination?.total === 'number' ? pagination.total : 0;
  const limit = typeof pagination?.limit === 'number' ? pagination.limit : JOBS_PAGE_LIMIT;
  const startIndex = total === 0 ? 0 : (page - 1) * limit + 1;
  const endIndex = total === 0 ? 0 : Math.min(page * limit, total);

  useEffect(() => {
    if (pagination && page > pagination.totalPages && pagination.totalPages > 0) {
      setPage(pagination.totalPages);
    }
  }, [pagination, page, setSearchParams]);

  useEffect(() => {
    if (debouncedSearch !== lastPushedSearch.current) {
      setSearchQuery(debouncedSearch);
      lastPushedSearch.current = debouncedSearch;
    }
  }, [debouncedSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== debouncedSearch) {
        lastPushedSearch.current = searchQuery;
        setSearchParams(prev => {
          prev.delete('page');
          if (searchQuery) prev.set('search', searchQuery);
          else prev.delete('search');
          return prev;
        }, { replace: Boolean(debouncedSearch) && Boolean(searchQuery) });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, debouncedSearch, setSearchParams]);

  useEffect(() => {
    if (queryError && !isSessionExpiredError(queryError)) {
      showApiError(queryError, 'Failed to load jobs');
    }
  }, [queryError]);

  const filteredJobs = jobs;

  const handleCreateHr = async (deliveryEmail) => {
    const job = credentialModal.job;
    if (!canManageHR || !job) return;

    setCreatingHrId(job._id);
    try {
      await createHrCredentials({
        jobId: job._id,
        name: `HR - ${job.title}`,
        deliveryEmail,
      });
      queryClient.invalidateQueries({ queryKey: ADMIN_JOBS_ROOT_KEY });
      queryClient.invalidateQueries({ queryKey: APPLICATIONS_ROOT_KEY });
      toast.success('HR account created — credentials emailed');
      setCredentialModal({ open: false, job: null });
    } catch (error) {
      showApiError(error, 'Failed to create HR');
    } finally {
      setCreatingHrId(null);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredJobs.map(j => j._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleExport = async (filters) => {
    try {
      setIsExporting(true);
      const loadingToast = toast.loading('Generating Excel file...');

      const response = await exportJobs(filters);
      const blob = response.data;

      // Determine filename from header if possible, else fallback
      const contentDisposition = response.headers['content-disposition'];
      let filename = `Jobs_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch && filenameMatch.length === 2) {
          filename = filenameMatch[1];
        }
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Export completed successfully', { id: loadingToast });
      setExportModalOpen(false);
    } catch (error) {
      showApiError(error, 'Failed to export jobs');
    } finally {
      setIsExporting(false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      if (confirmModal.type === 'bulk') {
        if (selectedIds.length > 20) {
          toast.error('Cannot delete more than 20 jobs in a single bulk operation.');
          setDeleting(false);
          setConfirmModal({ open: false, type: 'single', id: null });
          return;
        }
        await bulkDeleteJobs({ ids: selectedIds });
        setSelectedIds([]);
        toast.success('Jobs deleted successfully');
      } else {
        await deleteJob(confirmModal.id);
        setSelectedIds(prev => prev.filter(i => i !== confirmModal.id));
        toast.success('Job deleted successfully');
      }
      // Invalidate to reflect cascade deletions
      queryClient.invalidateQueries({ queryKey: ADMIN_JOBS_ROOT_KEY });
      queryClient.invalidateQueries({ queryKey: JOBS_ROOT_KEY });
      queryClient.invalidateQueries({ queryKey: APPLICATIONS_ROOT_KEY });
      queryClient.invalidateQueries({ queryKey: SAVED_JOBS_KEY });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
    } catch (err) {
      showApiError(err, 'Failed to delete');
    } finally {
      setDeleting(false);
      setConfirmModal({ open: false, type: 'single', id: null });
    }
  };



  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <HiOutlineBriefcase className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Manage Jobs</h1>
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
              job{total === 1 ? '' : 's'}
            </p>
          </div>
          {canWriteJobs && selectedIds.length > 0 && (
            <div className="flex flex-col gap-1">
              <button
                disabled={selectedIds.length > 20}
                onClick={() => setConfirmModal({ open: true, type: 'bulk', id: null })}
                className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors border border-red-200 flex items-center gap-1 w-fit disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-50"
              >
                <HiOutlineTrash size={16} />
                Delete Selected ({selectedIds.length})
              </button>
              {selectedIds.length > 20 && (
                <span className="text-xs text-red-600">
                  Maximum 20 jobs can be deleted at once. Deselect some jobs to continue.
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
          {canWriteJobs && (
            <label className="flex items-center gap-2 text-sm text-slate-700 bg-white px-3 py-2 border border-slate-200 rounded-lg whitespace-nowrap cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={filteredJobs.length > 0 && filteredJobs.every(j => selectedIds.includes(j._id))}
                onChange={handleSelectAll}
                className="w-4 h-4 rounded border-slate-200 text-blue-600 focus:ring-blue-500"
              />
              Select Current Page
            </label>
          )}
          <input
            type="text"
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input text-sm w-full sm:w-64"
          />
          <FilterDropdown
            label="School"
            options={SCHOOLS}
            selected={selectedSchools}
            onChange={(vals) => handleFilterChange('school', vals)}
          />
          <FilterDropdown
            label="Graduation Year"
            options={getAllowedYears()}
            selected={selectedYears}
            onChange={(vals) => handleFilterChange('graduationYear', vals)}
          />
          {canReadJobs && (
            <button
              onClick={() => setExportModalOpen(true)}
              className="px-3 py-2 text-sm font-medium text-white bg-emerald-600 border border-transparent rounded-lg hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 transition-colors whitespace-nowrap"
            >
              Export Excel
            </button>
          )}
          {canWriteJobs && (
            <Link
              to="/admin/jobs/new"
              className="btn-primary text-sm py-2 whitespace-nowrap"
            >
              + Add Job
            </Link>
          )}
        </div>
      </div>

      {loading ? (
        <PageSkeleton variant="list" count={5} />
      ) : filteredJobs.length === 0 ? (
        <div className="text-center py-10">
          <div className="text-slate-400 text-sm">
            No jobs posted yet.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredJobs.map((job) => (
            <div
              key={job._id}
              className={`bg-white rounded-xl border ${selectedIds.includes(job._id) ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200'} shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
            >
              <div className="flex items-start gap-4 flex-1 min-w-0">
                {canWriteJobs && (
                  <div className="mt-1 shrink-0">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(job._id)}
                      onChange={() => toggleSelect(job._id)}
                      className="w-4 h-4 rounded border-slate-200 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </div>
                )}
                {job.logo ? (
                  <img
                    src={job.logo}
                    alt={`${job.company} logo`}
                    className="w-10 h-10 object-contain rounded-lg border border-slate-200 bg-white shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0">
                    <HiOutlineOfficeBuilding className="text-slate-500 text-xl" />
                  </div>
                )}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 truncate">{job.title}</h3>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 mt-1">
                      <span className="font-medium text-slate-700 truncate">{job.company}</span>
                      <span>•</span>
                      <span className="truncate">{job.location}</span>
                      <span>•</span>
                      <span className="capitalize whitespace-nowrap">{job.jobType}</span>
                    </div>
                  </div>
                  <div className="flex-[1.5] mt-3 lg:mt-0 min-w-0 flex lg:justify-end">
                    <div className="grid grid-cols-1 xl:grid-cols-[240px_minmax(160px,1fr)] 2xl:grid-cols-[280px_minmax(180px,1fr)] gap-x-6 gap-y-1.5 max-w-full shrink-0 text-sm">
                      <EligibilityDisplay label="Schools" items={job.eligibleSchools} />
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-slate-500 shrink-0">Salary:</span>
                        <span className="font-medium text-slate-600 truncate max-w-[120px] sm:max-w-[150px]" title={job.salary || 'Not disclosed'}>
                          {job.salary || 'Not disclosed'}
                        </span>
                      </div>
                      <EligibilityDisplay label="Years" items={job.graduationYears} />
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-slate-500 shrink-0">Deadline:</span>
                        <span className="font-medium text-slate-600 truncate">
                          {job.deadline ? formatDate(job.deadline) : 'Not specified'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {canManageHR && (
                  <button
                    onClick={() => {
                      if (job.hasHR) {
                        toast.error("An HR account already exists for this job");
                        return;
                      }

                      setCredentialModal({ open: true, job });
                    }}
                    disabled={creatingHrId === job._id}
                    className="p-2 rounded-lg text-slate-500 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
                    title="Create HR Credentials"
                  >
                    <span className="text-lg">🔐</span>
                  </button>
                )}
                {canReadApplications && (
                  <Link
                    to={`/admin/jobs/${job._id}/applicants`}
                    className="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-colors"
                    title="View Applicants"
                  >
                    <HiOutlineUsers size={18} />
                  </Link>
                )}
                {canWriteJobs && (
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/admin/jobs/${job._id}/edit`}
                      className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit Job"
                    >
                      <HiOutlinePencil size={18} />
                    </Link>
                    <button
                      onClick={() => setConfirmModal({ open: true, type: 'single', id: job._id })}
                      className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Job"
                    >
                      <HiOutlineTrash size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <PaginationControls pagination={pagination} onPageChange={setPage} disabled={fetching} />

      {canWriteJobs && confirmModal.open && (
        <ConfirmDialog
          title={confirmModal.type === 'bulk' ? "Delete Selected Jobs" : "Delete Job"}
          message="This action will permanently delete the selected job(s) and all associated applications. This cannot be undone."
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmModal({ open: false, type: 'single', id: null })}
          loading={deleting}
          delay={5}
        />
      )}

      <DeliveryEmailModal
        open={credentialModal.open}
        title="Send HR Credentials"
        description="Enter the email where HR login credentials will be sent. This email is NOT used for login."
        confirmLabel="Create & Send"
        loading={creatingHrId != null}
        onSubmit={handleCreateHr}
        onCancel={() => !creatingHrId && setCredentialModal({ open: false, job: null })}
      />
      <ExportJobsModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExport={handleExport}
        isExporting={isExporting}
      />
    </div>
  );
}
