import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { HiMagnifyingGlass, HiFunnel, HiArrowDownTray, HiDocumentText } from 'react-icons/hi2';
import { useApplications } from '../../hooks/useApplications';
import ApplicantCard from '../../components/applicant/ApplicantCard';
import BulkActionBar from '../../components/BulkActionBar';
import StatusConfirmationModal from '../../components/StatusConfirmationModal';
import ApplicantProfileModal from '../../components/applicant/ApplicantProfileModal';
import PageSkeleton from '../../components/PageSkeleton';
import RefreshButton from '../../components/common/RefreshButton';
import toast from 'react-hot-toast';
import { showApiError } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/rbac';
import { getJobById } from '../../services/jobService';
import PaginationControls from '../../components/ui/PaginationControls';
import { HiOutlineUsers } from 'react-icons/hi2';
import ExportApplicantsModal from '../../components/applicant/ExportApplicantsModal';
import { useApplicantExport } from '../../hooks/useApplicantExport';
import CsvPreviewModal from '../../components/applicant/CsvPreviewModal';
import ApplicantSummaryCards from '../../components/applicant/ApplicantSummaryCards';

const statusFilters = ['All', 'In Progress', 'Rejected', 'Selected'];

const mapUIToAPI = {
  'In Progress': 'in_progress',
  'Selected': 'selected',
  'Rejected': 'rejected'
};

const normalizeStatus = (s) => {
  if (!s) return '';
  const lower = s.toLowerCase();
  if (['pending', 'shortlisted', 'in_progress', 'in-progress'].includes(lower)) return 'in_progress';
  if (lower === 'rejected') return 'rejected';
  if (lower === 'selected') return 'selected';
  return s;
};

export default function ViewApplicants() {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [jobContext, setJobContext] = useState(null);

  useEffect(() => {
    let isMounted = true;
    if (id) {
      getJobById(id).then(res => {
        if (isMounted) {
          setJobContext(res.data?.data || res.data);
        }
      }).catch(() => {
        // Ignored
      });
    }
    return () => { isMounted = false; };
  }, [id]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  const {
    applications,
    pagination,
    loading,
    fetching,
    error,
    rawError,
    refetch,
    updateStatus,
    bulkUpdate,
    counts,
  } = useApplications({
    scope: 'job-applicants',
    endpoint: `/applications/admin/job/${id}`,
    page,
    limit: 50,
    search: debouncedSearch,
    status,
    enabled: Boolean(id),
  });


  // Single-applicant confirmation modal state
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    application: null,
    action: null,
  });
  const [updating, setUpdating] = useState(false);

  // Profile modal state
  const [profileModal, setProfileModal] = useState({ open: false, student: null });

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectedApplicantMeta, setSelectedApplicantMeta] = useState(new Map());
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const applicationsRef = useRef(applications);
  useEffect(() => {
    applicationsRef.current = applications;
  }, [applications]);

  // Export state
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const { exportApplicants, isExporting } = useApplicantExport();

  // CSV Preview state
  const [csvModalOpen, setCsvModalOpen] = useState(false);

  useEffect(() => {
    const handleApplicationsChanged = () => {
      refetch();
    };

    window.addEventListener('placehub:applicationsChanged', handleApplicationsChanged);
    return () => window.removeEventListener('placehub:applicationsChanged', handleApplicationsChanged);
  }, [refetch]);

  useEffect(() => {
    if (pagination && page > pagination.totalPages && pagination.totalPages > 0) {
      setPage(pagination.totalPages);
    }
  }, [pagination, page]);

  useEffect(() => {
    if (error && !rawError?._sessionExpired) {
      toast.error(error);
    }
  }, [error, rawError]);

  // --- Single applicant actions ---
  const handleAction = (application, action) => {
    if (!canManage) return;

    setConfirmModal({ open: true, application, action });
  };

  const confirmStatusUpdate = async (payload) => {
    if (!canManage) return;

    const { application, action } = confirmModal;
    if (!application || !action) return;

    setUpdating(true);
    try {
      const updatePayload = {
        action,
        customMessage: payload?.customMessage || "",
        expectedRound: Number(application.currentRound) || 1,
        expectedStatus: application.status,
      };

      if (action === 'reject' || action === 'Rejected') {
        updatePayload.isAbsent = payload?.isAbsent || false;
      }

      const { data, error, rawError } = await updateStatus(application._id, updatePayload);
      if (error) {
        if (!rawError?._sessionExpired) toast.error(error);
        return;
      }
      const label =
        action === 'promote'
          ? data.status === 'selected'
            ? 'Candidate selected!'
            : `Moved to Round ${data.currentRound}`
          : 'Candidate rejected';
      toast.success(label);
      setConfirmModal({ open: false, application: null, action: null });
    } catch (err) {
      showApiError(err, 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  // --- Bulk selection ---
  const toggleSelect = useCallback((appId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(appId)) {
        next.delete(appId);
      } else {
        if (next.size >= 30) {
          toast.error('You can only select up to 30 applicants');
          return next;
        }
        next.add(appId);
      }
      return next;
    });

    setSelectedApplicantMeta((prev) => {
      const next = new Map(prev);
      if (next.has(appId)) {
        next.delete(appId);
      } else {
        const visibleApp = applicationsRef.current.find(a => a._id === appId);
        if (visibleApp) {
          next.set(appId, {
            id: visibleApp._id,
            currentRound: visibleApp.currentRound,
            status: visibleApp.status,
            jobId: visibleApp.job?._id || visibleApp.jobId,
            rounds: visibleApp.job?.rounds || visibleApp.rounds || [],
          });
        }
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectedApplicantMeta(new Map());
  }, []);

  // Clear selection when navigating to a different job
  useEffect(() => {
    clearSelection();
  }, [id, clearSelection]);

  // In-progress applicants in the current filtered view (for Select All)
  const selectableApplicants = useMemo(
    () => applications.filter((a) => normalizeStatus(a.status) === 'in_progress'),
    [applications]
  );

  const allSelectableSelected =
    selectableApplicants.length > 0 &&
    selectableApplicants.every((a) => selectedIds.has(a._id));

  const toggleSelectAll = useCallback(() => {
    if (allSelectableSelected) {
      clearSelection();
    } else {
      const nextSelection = selectableApplicants.slice(0, 30);
      setSelectedIds(new Set(nextSelection.map(a => a._id)));

      setSelectedApplicantMeta((prev) => {
        const next = new Map(prev);
        nextSelection.forEach((a) => {
          next.set(a._id, {
            id: a._id,
            currentRound: a.currentRound,
            status: a.status,
            jobId: a.job?._id || a.jobId,
            rounds: a.job?.rounds || a.rounds || [],
          });
        });
        return next;
      });

      if (selectableApplicants.length > 30) {
        toast.success(`Selected first 30 applicants (maximum limit)`);
      }
    }
  }, [allSelectableSelected, selectableApplicants, clearSelection]);

  // Derived State
  const applicationsById = useMemo(() => {
    const map = new Map();
    applications.forEach(app => map.set(app._id, app));
    return map;
  }, [applications]);

  const effectiveSelectedMeta = useMemo(() => {
    const effective = new Map();
    for (const id of selectedIds) {
      const visibleApp = applicationsById.get(id);
      if (visibleApp) {
        effective.set(id, {
          id: visibleApp._id,
          currentRound: visibleApp.currentRound,
          status: visibleApp.status,
          jobId: visibleApp.job?._id || visibleApp.jobId,
          rounds: visibleApp.job?.rounds || visibleApp.rounds || [],
        });
      } else {
        const cached = selectedApplicantMeta.get(id);
        if (cached) {
          effective.set(id, cached);
        }
      }
    }
    return effective;
  }, [selectedIds, applicationsById, selectedApplicantMeta]);

  const bulkRoundContext = useMemo(() => {
    if (effectiveSelectedMeta.size === 0) return null;

    const metas = Array.from(effectiveSelectedMeta.values());
    const rounds = new Set(metas.map((a) => Number(a.currentRound) || 1));
    const jobs = new Set(metas.map((a) => a.jobId));
    const statuses = new Set(metas.map((a) => normalizeStatus(a.status)));

    if (rounds.size !== 1 || jobs.size !== 1 || statuses.size !== 1 || !statuses.has('in_progress')) {
      return { valid: false };
    }

    const currentRound = [...rounds][0];
    const jobRounds = metas[0]?.rounds || [];
    const totalRounds = jobRounds.length || 1;
    const currentRoundInfo = jobRounds.find((r) => r.order === currentRound) || jobRounds[currentRound - 1];
    const nextRoundInfo = jobRounds.find((r) => r.order === currentRound + 1) || jobRounds[currentRound];

    return {
      valid: true,
      currentRound,
      roundName: currentRoundInfo?.name || `Round ${currentRound}`,
      nextRoundName: nextRoundInfo?.name || `Round ${currentRound + 1}`,
      totalRounds,
      isFinalRound: currentRound >= totalRounds,
    };
  }, [effectiveSelectedMeta]);

  // --- Bulk action handler ---
  const handleBulkAction = async (action, { customMessage = '', useCustomMessage = false, isAbsent = false } = {}) => {
    if (!canManage) return;

    if (!bulkRoundContext?.valid) {
      toast.error('All selected applicants must be in the same round');
      return;
    }

    setBulkUpdating(true);
    try {
      const { data, error, rawError } = await bulkUpdate({
        applicantIds: [...selectedIds],
        action,
        customMessage,
        useCustomMessage,
        isAbsent,
        expectedRound: bulkRoundContext.currentRound,
        expectedStatus: 'in_progress',
      });
      if (error) {
        if (!rawError?._sessionExpired) toast.error(error);
        return;
      }

      const updated = data?.count || 0;
      const skipped = data?.skipped || 0;

      if (skipped > 0) {
        toast.success(`${updated} applicant(s) updated successfully. ${skipped} applicant(s) were skipped because they were updated by another user.`);
      } else {
        const label =
          action === 'next_round'
            ? bulkRoundContext.isFinalRound
              ? `${updated} applicant(s) selected!`
              : `${updated} applicant(s) moved to next round`
            : `${updated} applicant(s) rejected`;
        toast.success(label);
      }
      clearSelection();
    } catch (err) {
      showApiError(err, 'Bulk update failed');
    } finally {
      setBulkUpdating(false);
    }
  };

  // --- Export handler ---
  const handleExport = (payload) => {
    exportApplicants(id, payload, () => setExportModalOpen(false));
  };

  if (loading && !jobContext) {
    return <PageSkeleton variant="list" count={4} />;
  }

  const jobTitle = jobContext?.title || applications[0]?.job?.title || 'Job';
  const jobRounds = jobContext?.rounds || applications[0]?.job?.rounds || [];
  const canManage =
    user?.role === 'admin' ||
    user?.role === 'hr' ||
    hasPermission(user, 'applications', 'write');

  const role = user?.role?.toLowerCase();
  const canBulkAction =
    role === "admin" ||
    role === "hr" ||
    hasPermission(user, 'applications', 'write');

  const canExport =
    role === "admin" ||
    role === "hr" ||
    hasPermission(user, 'applications', 'read') ||
    hasPermission(user, 'applications', 'write');

  // Derive single-action modal context
  const modalApp = confirmModal.application;
  const modalRounds = modalApp?.job?.rounds || [];
  const modalCurrentRound = Number(modalApp?.currentRound) || 1;
  const modalTotalRounds = modalRounds.length || 1;
  const currentRoundInfo = modalRounds.find((r) => r.order === modalCurrentRound) || modalRounds[modalCurrentRound - 1];
  const nextRoundInfo = modalRounds.find((r) => r.order === modalCurrentRound + 1) || modalRounds[modalCurrentRound];

  const total = pagination?.total || 0;
  const currentLimit = pagination?.limit || 50;
  const start = total === 0 ? 0 : (page - 1) * currentLimit + 1;
  const end = Math.min(page * currentLimit, total);

  return (
    <div>
      <div className="mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Back to Jobs
        </button>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mt-2 gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <HiOutlineUsers className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-slate-900 tracking-tight break-words">Applicants for {jobTitle}</h1>
              <p className="text-sm text-slate-600 mt-0.5">
                {pagination?.total ?? applications.length} applicant{(pagination?.total ?? applications.length) !== 1 ? 's' : ''}
              </p>
              {jobRounds.length > 0 && (
                <p className="text-sm mt-1">
                  <span className="text-slate-700 font-medium">{jobRounds.length} round{jobRounds.length !== 1 ? 's' : ''}:</span>
                  {jobRounds.map((r, i) => (
                    <span key={r.order || i}>
                      {i === 0 ? (
                        <span className="ml-1 text-slate-800 font-medium">{r.name}</span>
                      ) : (
                        <>
                          <span className="mx-1 text-slate-400">→</span>
                          <span className="text-slate-800 font-medium">{r.name}</span>
                        </>
                      )}
                    </span>
                  ))}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
            {canBulkAction && (
              <button
                onClick={() => setCsvModalOpen(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none whitespace-nowrap"
              >
                <HiDocumentText className="w-4 h-4 text-slate-500 shrink-0" />
                Upload CSV
              </button>
            )}
            {canExport && (
              <button
                onClick={() => setExportModalOpen(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-green-700 border border-transparent rounded-lg hover:bg-green-700 transition-colors shadow-sm focus:ring-2 focus:ring-green-500 focus:outline-none whitespace-nowrap"
              >
                <HiArrowDownTray className="w-4 h-4 text-white shrink-0" />
                Export Excel
              </button>
            )}
            <RefreshButton onClick={() => refetch()} loading={loading} fetching={fetching} />
          </div>
        </div>
      </div>


      <ApplicantSummaryCards counts={counts} loading={loading && applications.length === 0} />


      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <HiMagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-all"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <HiFunnel className="w-4 h-4 text-slate-400 shrink-0 mr-1" />
          {statusFilters.map((s) => (
            <button
              key={s}
              onClick={() => {
                setPage(1);
                setStatus(mapUIToAPI[s] || 'all');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 border ${status === (mapUIToAPI[s] || 'all')
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700'
                }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Select All checkbox */}
      {canManage && selectableApplicants.length > 0 && (
        <div className="flex items-center gap-2 mb-3 px-1">
          <input
            type="checkbox"
            checked={allSelectableSelected}
            onChange={toggleSelectAll}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <span className="text-xs text-slate-800 font-medium">
            Select all in-progress ({selectableApplicants.length})
            <span className="ml-1 opacity-200">(Max 30)</span>
          </span>
          {selectedIds.size > 0 && (
            <span className="text-xs text-blue-600 font-semibold ml-2">
              {selectedIds.size} selected
            </span>
          )}
        </div>
      )}

      <div className="text-sm text-slate-600 mb-3 px-1">
        Showing{' '}
        {total === 0 ? (
          <>
            <span className="font-medium text-slate-900">0</span> of <span className="font-medium text-slate-900">0</span>
          </>
        ) : (
          <>
            <span className="font-medium text-slate-900">{start}</span>
            –
            <span className="font-medium text-slate-900">{end}</span> of <span className="font-medium text-slate-900">{total.toLocaleString()}</span>
          </>
        )}{' '}
        applicant{total === 1 ? '' : 's'}
      </div>

      {applications.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <p className="text-slate-500">No applicants match your criteria.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <ApplicantCard
              key={app._id}
              application={app}
              canManageStatus={canManage}
              onAction={canManage ? handleAction : undefined}
              onViewProfile={(student) => setProfileModal({ open: true, student })}
              selectable={canManage && normalizeStatus(app.status) === 'in_progress'}
              isSelected={selectedIds.has(app._id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}

      <PaginationControls pagination={pagination} onPageChange={setPage} disabled={fetching} itemLabel="Applicants" />

      {/* Bulk Action Bar */}
      {canBulkAction && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          onAction={handleBulkAction}
          onClear={clearSelection}
          loading={bulkUpdating}
          currentRound={bulkRoundContext?.currentRound}
          roundName={bulkRoundContext?.roundName}
          nextRoundName={bulkRoundContext?.nextRoundName}
          totalRounds={bulkRoundContext?.totalRounds}
          isFinalRound={bulkRoundContext?.isFinalRound}
        />
      )}

      {/* Single Status Confirmation Modal */}
      {canManage && (
        <StatusConfirmationModal
          isOpen={confirmModal.open}
          onClose={() => setConfirmModal({ open: false, application: null, action: null })}
          onConfirm={confirmStatusUpdate}
          candidateName={modalApp?.student?.name || 'this candidate'}
          action={confirmModal.action}
          currentRound={modalCurrentRound}
          roundName={currentRoundInfo?.name}
          nextRoundName={nextRoundInfo?.name}
          totalRounds={modalTotalRounds}
          loading={updating}
        />
      )}

      {/* Profile Modal */}
      <ApplicantProfileModal
        isOpen={profileModal.open}
        onClose={() => setProfileModal({ open: false, student: null })}
        student={profileModal.student}
      />

      {/* Export Modal */}
      <ExportApplicantsModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExport={handleExport}
        jobContext={jobContext || applications[0]?.job}
        isExporting={isExporting}
      />

      {/* CSV Preview Modal */}
      <CsvPreviewModal
        isOpen={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        jobId={id}
      />
    </div>
  );
}
