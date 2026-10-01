import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useJobs } from '../hooks/useJobs';
import { useClosedJobs } from '../hooks/useClosedJobs';
import JobCard from '../components/job/JobCard';
import PageSkeleton from '../components/PageSkeleton';
import RefreshButton from '../components/common/RefreshButton';
import { HiOutlineSearch, HiInformationCircle, HiOutlineBriefcase } from 'react-icons/hi';
import PaginationControls from '../components/ui/PaginationControls';

export default function Jobs() {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = searchParams.get('tab') === 'closed' ? 'closed' : 'active';
  const page = Math.max(1, parseInt(searchParams.get('page')) || 1);
  const debouncedSearch = searchParams.get('search') || '';

  const queryString = `page=${page}&limit=12${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ''}`;

  const activeJobsHook = useJobs({ queryString, enabled: activeTab === 'active' });
  const closedJobsHook = useClosedJobs({ queryString, enabled: activeTab === 'closed' });

  const currentHook = activeTab === 'active' ? activeJobsHook : closedJobsHook;
  const { jobs, pagination, loading, fetching, error, refetch } = currentHook;

  const currentPage = pagination?.page || page || 1;
  const limit = pagination?.limit || 12;
  const total = Number.isFinite(Number(pagination?.total)) ? Number(pagination.total) : 0;
  const startItem = total === 0 ? 0 : (currentPage - 1) * limit + 1;
  const endItem = Math.min(currentPage * limit, total);
  const showPaginationControls = total > limit;

  const [search, setSearch] = useState(debouncedSearch);
  const lastPushedSearch = useRef(debouncedSearch);

  const setPage = (newPage) => {
    setSearchParams(prev => {
      if (newPage <= 1) prev.delete('page');
      else prev.set('page', newPage);
      return prev;
    });
  };

  useEffect(() => {
    if (pagination && page > pagination.totalPages && pagination.totalPages > 0) {
      setPage(pagination.totalPages);
    }
  }, [pagination, page, setSearchParams]);

  useEffect(() => {
    if (debouncedSearch !== lastPushedSearch.current) {
      setSearch(debouncedSearch);
      lastPushedSearch.current = debouncedSearch;
    }
  }, [debouncedSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
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
    return () => clearTimeout(timer);
  }, [search, debouncedSearch, setSearchParams]);

  const handleTabChange = (tab) => {
    setSearchParams(prev => {
      prev.delete('page');
      if (tab === 'closed') prev.set('tab', 'closed');
      else prev.delete('tab');
      return prev;
    });
  };

  const handleSearch = (e) => {
    e.preventDefault();
  };

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <HiOutlineBriefcase className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-semibold text-slate-900 tracking-tight">Browse Jobs</h1>
            </div>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-lg w-full sm:w-auto">
            <button
              onClick={() => handleTabChange('active')}
              className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-medium text-slate-600 rounded-md transition-colors whitespace-nowrap text-center ${activeTab === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Active Jobs {activeJobsHook.pagination?.total !== undefined ? `(${activeJobsHook.pagination.total})` : ''}
            </button>
            <button
              onClick={() => handleTabChange('closed')}
              className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-medium text-slate-600 rounded-md transition-colors whitespace-nowrap text-center ${activeTab === 'closed' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Closed Jobs {closedJobsHook.pagination?.total !== undefined ? `(${closedJobsHook.pagination.total})` : ''}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 self-end sm:self-auto">
          {total > 0 && (
            <span className="text-sm font-medium text-slate-700 whitespace-nowrap">
              Showing <strong className="font-semibold text-slate-900">{startItem}</strong>–<strong className="font-semibold text-slate-900">{endItem}</strong> of <strong className="font-semibold text-slate-900">{total}</strong> Jobs
            </span>
          )}
          <RefreshButton onClick={() => refetch()} loading={loading} fetching={fetching} />
        </div>
      </div>

      {activeTab === 'closed' && (
        <div className="mb-6 flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-800">
          <HiInformationCircle size={20} className="shrink-0 mt-0.5" />
          <p className="text-sm">These are jobs you missed &mdash; they were open, but you did not apply before the deadline.</p>
        </div>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6 bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
        <div className="relative">
          <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
          <input
            type="text"
            value={search}
            onChange={handleSearchChange}
            placeholder="Search jobs by title or company..."
            className="w-full pl-12 pr-4 py-3 input rounded-xl text-base"
          />
        </div>
      </form>

      {error && !loading && (
        <div className="mb-4 text-sm text-red-600">{error}</div>
      )}

      {/* Job list */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <PageSkeleton key={i} variant="card" />
          ))
        ) : jobs.length === 0 ? (
          <div className="col-span-full bg-white rounded-xl border border-slate-200 shadow-sm p-12 flex flex-col items-center justify-center text-center">
            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <HiOutlineSearch className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-sm text-slate-600">No jobs found</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your search.</p>
          </div>
        ) : (
          jobs.map((job) => (
            <JobCard key={job._id} job={job} isMissedOpportunity={activeTab === 'closed'} />
          ))
        )}
      </div>

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
