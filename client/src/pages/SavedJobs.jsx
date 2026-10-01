import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getSavedJobs } from '../services/savedJobService';
import JobCard from '../components/job/JobCard';
import { showApiError } from '../services/api';
import { handleApiResponse } from '../utils/apiHandler';
import PageSkeleton from '../components/PageSkeleton';
import { CACHE_TIMES } from '../services/queryClient';
import PaginationControls from '../components/ui/PaginationControls';
import { HiOutlineBookmark } from 'react-icons/hi';

export default function SavedJobs() {
  const [page, setPage] = useState(1);

  const {
    data,
    isLoading: loading,
    isFetching: fetching,
    error,
  } = useQuery({
    queryKey: ['saved-jobs', page],
    queryFn: async () => {
      const response = await getSavedJobs({ page, limit: 12 });
      return handleApiResponse(response);
    },
    staleTime: CACHE_TIMES.jobs,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (error) {
      showApiError(error, 'Failed to load saved jobs');
    }
  }, [error]);

  useEffect(() => {
    if (data?.pagination && page > data.pagination.totalPages && data.pagination.totalPages > 0) {
      setPage(data.pagination.totalPages);
    }
  }, [data?.pagination, page]);

  const saved = data?.items || [];
  const pagination = data?.pagination || null;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 shadow-2xs">
            <HiOutlineBookmark className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">Saved Jobs</h1>
              {!loading && saved.length > 0 && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                  {saved.length} {saved.length === 1 ? 'Job' : 'Jobs'}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-600 mt-0.5">Track and manage jobs you bookmarked for later review.</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <PageSkeleton key={i} variant="card" />
          ))
        ) : saved.length === 0 ? (
          <div className="col-span-full py-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8 sm:p-14 max-w-lg mx-auto text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-6 shadow-2xs ring-8 ring-blue-50/50">
                <HiOutlineBookmark className="w-8 h-8 sm:w-9 sm:h-9" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">No saved jobs yet</h3>
              <p className="text-sm sm:text-base text-slate-500 max-w-sm mx-auto mb-7 leading-relaxed">
                Get reminders when your saved jobs are closing soon.
              </p>
              <Link
                to="/jobs"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm hover:shadow transition-all duration-200"
              >
                Browse Available Jobs
              </Link>
            </div>
          </div>
        ) : (
          saved.map((item) => item.job && <JobCard key={item._id} job={item.job} />)
        )}
      </div>

      {!loading && saved.length > 0 && (
        <PaginationControls pagination={pagination} onPageChange={setPage} disabled={fetching} />
      )}
    </div>
  );
}
