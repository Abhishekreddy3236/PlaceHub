import { useEffect, useState, useRef } from 'react';
import { HiMagnifyingGlass, HiDocumentText } from 'react-icons/hi2';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { APPLICATIONS_PAGE_LIMIT, useApplications } from '../hooks/useApplications';
import StatusBadge from '../components/ui/StatusBadge';
import PageSkeleton from '../components/PageSkeleton';
import RefreshButton from '../components/common/RefreshButton';
import toast from 'react-hot-toast';
import downloadResume from '../utils/downloadResume';
import { formatDate } from '../utils/dateFormatter';
import PaginationControls from '../components/ui/PaginationControls';
import { HiOutlineClipboardCheck } from 'react-icons/hi';
import api from '../services/api';
import { useQueryClient } from '@tanstack/react-query';
import { DASHBOARD_QUERY_KEY, APPLICATIONS_ROOT_KEY } from '../services/queryClient';
import { markApplicationsAsRead } from '../services/applicationService';

export default function MyApplications() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const page = Math.max(1, parseInt(searchParams.get('page')) || 1);
  const debouncedSearch = searchParams.get('search') || '';
  const status = searchParams.get('status') || 'all';

  const [search, setSearch] = useState(debouncedSearch);
  const lastPushedSearch = useRef(debouncedSearch);
  const [downloadingResumeIds, setDownloadingResumeIds] = useState(new Set());

  const setPage = (newPage) => {
    setSearchParams(prev => {
      if (newPage <= 1) prev.delete('page');
      else prev.set('page', newPage);
      return prev;
    });
  };

  const setStatus = (newStatus) => {
    setSearchParams(prev => {
      prev.delete('page');
      if (newStatus && newStatus !== 'all') prev.set('status', newStatus);
      else prev.delete('status');
      return prev;
    });
  };

  useEffect(() => {
    if (debouncedSearch !== lastPushedSearch.current) {
      setSearch(debouncedSearch);
      lastPushedSearch.current = debouncedSearch;
    }
  }, [debouncedSearch]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (search !== debouncedSearch) {
        lastPushedSearch.current = search;
        setSearchParams(prev => {
          prev.delete('page');
          if (search) prev.set('search', search);
          else prev.delete('search');
          return prev;
        }, { replace: Boolean(debouncedSearch) && Boolean(search) });
      }
    }, 400);
    return () => clearTimeout(handler);
  }, [search, debouncedSearch, setSearchParams]);

  const queryClient = useQueryClient();

  useEffect(() => {
    const dashboardData = queryClient.getQueryData(DASHBOARD_QUERY_KEY);
    const unreadCount = dashboardData?.unreadCount || 0;

    if (unreadCount > 0) {
      markApplicationsAsRead().then(() => {
        queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: APPLICATIONS_ROOT_KEY });
      }).catch(() => { });
    }
  }, [queryClient]);

  const {
    applications,
    pagination,
    loading,
    fetching,
    error,
    rawError,
    refetch,
  } = useApplications({ scope: 'my', page, limit: APPLICATIONS_PAGE_LIMIT, search: debouncedSearch, status });

  const currentPage = pagination?.page || page || 1;
  const limit = pagination?.limit || APPLICATIONS_PAGE_LIMIT || 10;
  const total = Number.isFinite(Number(pagination?.total)) ? Number(pagination.total) : 0;
  const startItem = total === 0 ? 0 : (currentPage - 1) * limit + 1;
  const endItem = Math.min(currentPage * limit, total);
  const showPaginationControls = total > limit;

  const handleViewResume = async (id) => {
    if (downloadingResumeIds.has(id)) return;
    setDownloadingResumeIds(prev => new Set(prev).add(id));
    
    try {
      const res = await api.get(`/applications/${id}/resume?mode=json`);
      const url = res.data?.data?.resumeUrl;

      if (!url || typeof url !== 'string') {
        toast.error('Resume not available');
        return;
      }

      const newTab = window.open('', '_blank');
      if (newTab) {
        newTab.location.href = url;
      } else {
        // Fallback if popup blocked
        window.location.href = url;
      }
    } catch (err) {
      toast.error('Failed to load resume');
    } finally {
      setDownloadingResumeIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  useEffect(() => {
    if (error && !rawError?._sessionExpired) {
      toast.error(error);
    }
  }, [error, rawError]);

  useEffect(() => {
    if (pagination && page > pagination.totalPages && pagination.totalPages > 0) {
      setPage(pagination.totalPages);
    }
  }, [pagination, page]);

  if (loading) {
    return <PageSkeleton variant="list" count={4} />;
  }

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <HiOutlineClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-slate-900 tracking-tight">My Applications</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <HiMagnifyingGlass className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-base placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow"
              placeholder="Search applications..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
            />
          </div>
          <RefreshButton onClick={() => refetch()} loading={loading} fetching={fetching} />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-1 sm:gap-1.5 p-1.5 bg-slate-100/90 border border-slate-200/80 rounded-xl shadow-2xs overflow-x-auto w-full sm:w-auto">
          {[
            { label: 'All', value: 'all' },
            { label: 'In Progress', value: 'in_progress' },
            { label: 'Selected', value: 'selected' },
            { label: 'Rejected', value: 'rejected' },
          ].map((tab) => {
            const isActive = status === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => {
                  setStatus(tab.value);
                }}
                className={`flex-1 sm:flex-initial px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap text-center shrink-0 ${isActive
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {total > 0 && (
          <span className="text-sm font-medium text-slate-700 self-end sm:self-auto whitespace-nowrap">
            Showing <strong className="font-semibold text-slate-900">{startItem}</strong>–<strong className="font-semibold text-slate-900">{endItem}</strong> of <strong className="font-semibold text-slate-900">{total}</strong> Applications
          </span>
        )}
      </div>

      {applications.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <p className="text-slate-500">No applications yet. Start applying to jobs!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => {
            const jobId = app.job?._id;
            const isDownloadingResume = downloadingResumeIds.has(app._id);

            return (
              <div
                key={app._id}
                onClick={() => {
                  if (jobId) {
                    navigate(`/jobs/${jobId}`);
                  }
                }}
                className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 hover:shadow-md transition-all ${jobId ? 'cursor-pointer hover:border-blue-200' : ''
                  }`}
              >
                <div className="flex items-start justify-between gap-3 sm:gap-4">
                  <div className="min-w-0 flex-1">
                    {jobId ? (
                      <Link
                        to={`/jobs/${jobId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-base sm:text-lg md:text-xl font-semibold text-slate-900 hover:text-blue-600 transition-colors block leading-snug truncate"
                      >
                        {app.job?.title || 'Job Unavailable'}
                      </Link>
                    ) : (
                      <span className="text-base sm:text-lg md:text-xl font-semibold text-slate-900 block leading-snug truncate">Job Unavailable</span>
                    )}
                    <p className="text-sm sm:text-base text-slate-600 mt-1 truncate">
                      <span className="text-blue-600 font-semibold hover:text-blue-700 transition">{app.job?.company}</span> &middot; {app.job?.location}
                    </p>
                    <p className="mt-1.5 text-sm">
                      <span className="text-slate-600 font-medium mr-1.5">Applied</span>
                      <span className="text-slate-900 font-semibold whitespace-nowrap">{formatDate(app.createdAt)}</span>
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewResume(app._id);
                      }}
                      disabled={isDownloadingResume}
                      className={`mt-3 sm:mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-50 text-blue-700 text-sm font-medium sm:font-normal hover:bg-blue-100 transition whitespace-nowrap shrink-0 w-fit ${isDownloadingResume ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {isDownloadingResume ? (
                        <div className="w-4 h-4 border-2 border-blue-700 border-t-transparent rounded-full animate-spin shrink-0" />
                      ) : (
                        <HiDocumentText className="w-4 h-4 shrink-0" />
                      )}
                      <span>View Resume</span>
                    </button>
                  </div>
                  <div className="shrink-0">
                    <StatusBadge
                      status={app.status}
                      currentRound={app.currentRound}
                      rounds={app.job?.rounds}
                      rejectedAtRound={app.rejectedAtRound}
                      showRoundDetail
                      isAbsent={app.rejectionInfo?.isAbsent}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showPaginationControls && (
        <div className="mt-6 flex justify-end">
          <div className="[&>div]:!mt-0 w-full sm:w-auto">
            <PaginationControls
              pagination={{ ...pagination, total: 0 }}
              onPageChange={setPage}
              disabled={fetching}
            />
          </div>
        </div>
      )}
    </div>
  );
}
