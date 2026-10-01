import { Link } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { getDashboardData } from '../services/dashboardService';
import { CACHE_TIMES, DASHBOARD_QUERY_KEY } from '../services/queryClient';
import JobCard from '../components/job/JobCard';
import PageSkeleton from '../components/PageSkeleton';
import { HiOutlineBriefcase, HiOutlineBookmark, HiOutlineClipboardCheck, HiOutlineUser, HiOutlineHome, HiOutlineMoon, HiLightningBolt, HiOutlineExclamationCircle } from 'react-icons/hi';
import { DASHBOARD_QUOTES } from '../utils/dashboardQuotes';
import PWAInstallBanner from '../components/ui/PWAInstallBanner';
import PushNotificationBanner from '../components/notifications/PushNotificationBanner';

export default function Dashboard() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const response = await getDashboardData({ signal });
      return response.data?.data || {};
    },
    staleTime: CACHE_TIMES.dashboard,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: keepPreviousData,
  });

  const stats = data?.stats || { applications: 0, saved: 0 };
  const recentJobs = data?.recentJobs || [];
  const displayUser = data?.user || user || {};
  const displayName = displayUser.name || user?.name || '';
  const displayShortName = displayName ? displayName.trim().split(/\s+/).slice(0, 2).join(' ') : '';
  const profileStatus = data?.profileStatus;
  const reminders = data?.reminders || [];
  const unreadCount = data?.unreadCount || 0;
  const recentStatusUpdates = data?.recentStatusUpdates || [];

  const getStatusDisplay = (app) => {
    if (app.status === 'selected') return 'Selected';
    if (app.status === 'rejected') return 'Rejected';
    if (app.status === 'in_progress' && app.currentRound > 1) return `Shortlisted for Round ${app.currentRound}`;
    if (app.status === 'in_progress') return 'In Progress';
    return app.status;
  };

  const STATUS_THEME_TOKENS = {
    green: {
      border: 'border-l-emerald-500',
      pill: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20',
      dot: 'bg-emerald-500',
      label: 'text-emerald-600',
      icon: '✓',
    },
    blue: {
      border: 'border-l-blue-600',
      pill: 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20',
      dot: 'bg-blue-600',
      label: 'text-blue-600',
      icon: '●',
    },
    amber: {
      border: 'border-l-amber-500',
      pill: 'bg-amber-50 text-amber-800 ring-1 ring-amber-600/20',
      dot: 'bg-amber-500',
      label: 'text-amber-600',
      icon: '●',
    },
    red: {
      border: 'border-l-rose-500',
      pill: 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20',
      dot: 'bg-rose-500',
      label: 'text-rose-600',
      icon: '✕',
    },
    slate: {
      border: 'border-l-slate-400',
      pill: 'bg-slate-100 text-slate-700 ring-1 ring-slate-600/20',
      dot: 'bg-slate-500',
      label: 'text-slate-600',
      icon: '●',
    },
  };

  const getStatusTheme = (app) => {
    if (!app) return STATUS_THEME_TOKENS.blue;
    const rawStatus = String(app.status || '').trim().toLowerCase();

    // 1. Exact backend enum match
    if (rawStatus === 'selected' || rawStatus === 'shortlisted') {
      return STATUS_THEME_TOKENS.green;
    }
    if (rawStatus === 'rejected') {
      return STATUS_THEME_TOKENS.red;
    }
    if (rawStatus === 'in_progress') {
      if (Number(app.currentRound) > 1) {
        return STATUS_THEME_TOKENS.green;
      }
      return STATUS_THEME_TOKENS.blue;
    }

    // 2. Exact fallback for legacy/extended statuses
    if (['pending', 'waitlisted', 'waitlist'].includes(rawStatus)) {
      return STATUS_THEME_TOKENS.amber;
    }
    if (['withdrawn', 'closed', 'inactive'].includes(rawStatus)) {
      return STATUS_THEME_TOKENS.slate;
    }
    if (['offer_released', 'offer_accepted', 'placed', 'offer'].includes(rawStatus)) {
      return STATUS_THEME_TOKENS.green;
    }

    return STATUS_THEME_TOKENS.blue;
  };

  const getFormattedUpdateAgo = (dateStr) => {
    if (!dateStr) return 'Recently';
    const parsedDate = new Date(dateStr);
    if (Number.isNaN(parsedDate.getTime())) return 'Recently';

    const now = new Date();
    const diffMs = now.getTime() - parsedDate.getTime();
    if (diffMs < 0) return 'Today';

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 14) return 'This week';

    return 'Recently';
  };

  const getProfileCompletenessPercent = () => {
    if (!profileStatus) return 100; // default if not provided
    const totalFields = 9; // based on profileCompleteness.js REQUIRED_APPLICATION_PROFILE_FIELDS
    const missing = profileStatus.missingFields?.length || 0;
    return Math.round(((totalFields - missing) / totalFields) * 100);
  };

  const getFormattedTime = (dateString) => {
    const rawHours = (new Date(dateString) - new Date()) / (1000 * 60 * 60);
    if (rawHours <= 0) return 'Closed';
    if (rawHours < 1) return 'Less than 1 hour';
    const hours = Math.ceil(rawHours);
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 12) return 'Good Morning';
    if (hour >= 12 && hour < 17) return 'Good Afternoon';
    if (hour >= 17 && hour < 24) return 'Good Evening';
    return 'Good Night';
  };

  const getDailyQuote = () => {
    const today = new Date();
    const dateString = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    let hash = 0;
    for (let i = 0; i < dateString.length; i++) {
      hash = (hash << 5) - hash + dateString.charCodeAt(i);
      hash |= 0;
    }
    const index = Math.abs(hash) % DASHBOARD_QUOTES.length;
    return DASHBOARD_QUOTES[index];
  };

  const isLateNight = () => {
    const hour = new Date().getHours();
    return hour >= 0 && hour < 4;
  };

  return (
    <div>
      <PWAInstallBanner />
      <PushNotificationBanner />
      {/* Welcome - Editorial SaaS Header */}
      <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white px-6 py-5 sm:px-7 sm:py-6 shadow-[0_2px_8px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)]">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm font-medium tracking-wide text-slate-600 mb-2">
              <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>


            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight leading-tight">
              {getGreeting()}
              {displayShortName && (
                <>
                  {', '}
                  <span className="text-blue-700">{displayShortName}</span>
                </>
              )}
            </h1>

            <p className="text-base font-medium text-slate-600 mt-1">
              Here&apos;s what&apos;s happening with your placement journey today.
            </p>

            <p className="mt-3.5 text-sm md:text-base text-slate-600 italic">
              &ldquo;{getDailyQuote()}&rdquo;
            </p>
          </div>

          <div className="hidden lg:flex items-center gap-7 shrink-0 border-l border-slate-100/70 pl-7">
            <div>
              <div className="text-sm font-medium text-slate-600">Applications</div>
              <div className="text-3xl font-bold text-slate-900 mt-1">{stats.applications || 0}</div>
            </div>
            <div className="h-9 w-px bg-slate-100/70" />
            <div>
              <div className="text-sm font-medium text-slate-600">Saved Jobs</div>
              <div className="text-3xl font-bold text-slate-900 mt-1">{stats.saved || 0}</div>
            </div>
            <div className="h-9 w-px bg-slate-100/70" />
            <div>
              <div className="text-sm font-medium text-slate-600">Profile Status</div>
              <div className="text-3xl font-bold text-blue-600 mt-1">
                {isLoading ? (
                  <div className="h-8 w-14 bg-slate-200 rounded animate-pulse duration-1000 opacity-80" />
                ) : (
                  `${getProfileCompletenessPercent()}%`
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Late Night Message */}
      {isLateNight() && (
        <div className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 shadow-sm flex items-start gap-3">
          <div className="text-indigo-500 shrink-0 mt-0.5">
            <HiOutlineMoon size={20} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-indigo-900">Still working?</h3>
            <p className="text-sm text-indigo-700 mt-0.5">
              Hope you made meaningful progress today. Rest well and continue your journey tomorrow.
            </p>
          </div>
        </div>
      )}

      {/* Actionable Alerts (Reminders & Profile Completeness) */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {!isLoading && profileStatus && !profileStatus.complete && (
          <div className="rounded-2xl border border-slate-200 border-l-4 border-l-blue-600 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.05)] flex flex-col justify-between min-w-0">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-blue-600">
                  <span>PROFILE STATUS</span>
                </div>
                <span className="text-[11px] font-medium text-slate-400">Action Required</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-1 truncate">{getProfileCompletenessPercent()}% Complete</h3>
              <p className="text-base font-medium text-slate-600 mb-3.5 truncate">Complete your profile for recruiter visibility</p>
              <div className="mb-4">
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold bg-blue-50 text-blue-700 ring-1 ring-blue-600/20">
                  <span>{profileStatus.missingFields?.length || 0} missing field{(profileStatus.missingFields?.length || 0) !== 1 ? 's' : ''}</span>
                </span>
              </div>
            </div>
            <Link to="/profile" className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors inline-flex items-center gap-1">
              <span>Complete Profile</span>
              <span>&rarr;</span>
            </Link>
          </div>
        )}

        {!isLoading && reminders.map((reminder) => {
          const formattedTime = getFormattedTime(reminder.deadline);
          if (formattedTime === 'Closed') return null;

          return (
            <div key={reminder._id} className="rounded-2xl border border-slate-200 border-l-4 border-l-amber-500 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.05)] flex flex-col justify-between min-w-0">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                    <span>CLOSING SOON REMINDER</span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-400">Deadline</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-1 truncate">{reminder.title}</h3>
                <p className="text-base font-medium text-slate-600 mb-3.5 truncate">{reminder.company}</p>
                <div className="mb-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold bg-amber-50 text-amber-800 ring-1 ring-amber-600/20">
                    <span>{formattedTime} left</span>
                  </span>
                </div>
              </div>
              <Link to={`/jobs/${reminder._id}`} className="text-sm font-medium text-amber-600 hover:text-amber-700 hover:underline transition-colors inline-flex items-center gap-1">
                <span>Apply Now</span>
                <span>&rarr;</span>
              </Link>
            </div>
          );
        })}
      </div>

      {/* Application Status Updates (Notifications) */}
      {!isLoading && unreadCount > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {recentStatusUpdates.slice(0, 3).map((app) => {
            const theme = getStatusTheme(app);
            return (
              <div key={app._id} className={`rounded-2xl border border-slate-200 border-l-4 ${theme.border} bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.05)] flex flex-col justify-between min-w-0`}>
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${theme.label}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${theme.dot} shrink-0`} />
                      <span>APPLICATION UPDATE</span>
                    </div>
                    <span className="text-[11px] font-medium text-slate-400">
                      {getFormattedUpdateAgo(app.updatedAt)}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-1 truncate">{app.jobId?.title}</h3>
                  <p className="text-base font-medium text-slate-600 mb-3.5 truncate">{app.jobId?.companyId?.name || app.jobId?.company}</p>
                  <div className="mb-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${theme.pill}`}>
                      <span className="text-xs leading-none">{theme.icon}</span>
                      <span>{getStatusDisplay(app)}</span>
                    </span>
                  </div>
                </div>
                <Link to="/my-applications" className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors inline-flex items-center gap-1">
                  <span>View Application</span>
                  <span>&rarr;</span>
                </Link>
              </div>
            );
          })}
          {unreadCount > 3 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center p-5 shadow-sm">
              <div className="text-center">
                <p className="text-sm font-medium text-slate-600 mb-2">You have {unreadCount} application updates.</p>
                <Link to="/my-applications" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                  View all updates &rarr;
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Stats & Actions */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between ${i === 0 ? 'border-l-4 border-slate-200' : ''} min-w-0`}>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-200 animate-pulse duration-1000 opacity-80" />
                <div className="flex flex-col leading-tight w-full">
                  <div className="h-8 w-12 bg-slate-200 rounded animate-pulse duration-1000 opacity-80" />
                  <div className="h-3 w-28 bg-slate-200 rounded mt-2 animate-pulse duration-1000 opacity-80" />
                </div>
              </div>
              <div className="h-4 w-12 bg-slate-200 rounded mt-4 animate-pulse duration-1000 opacity-80" />
            </div>
          ))
        ) : (
          <>
            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between hover:border-slate-300 transition-colors min-w-0">
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-slate-700">
                  <HiOutlineClipboardCheck size={22} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg md:text-xl font-semibold text-slate-900 truncate">Total Applications</h3>
                  <p className="text-base font-medium text-slate-600 mt-0.5">{stats.applications || 0} submitted</p>
                </div>
              </div>
              <Link to="/my-applications" className="text-sm font-semibold text-blue-600 hover:text-blue-700 mt-4 transition-colors inline-flex items-center gap-1">
                <span>View Applications</span>
                <span>&rarr;</span>
              </Link>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between hover:border-slate-300 transition-colors min-w-0">
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-slate-700">
                  <HiOutlineBookmark size={22} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg md:text-xl font-semibold text-slate-900 truncate">Saved Jobs</h3>
                  <p className="text-base font-medium text-slate-600 mt-0.5">{stats.saved || 0} bookmarked</p>
                </div>
              </div>
              <Link to="/saved-jobs" className="text-sm font-semibold text-blue-600 hover:text-blue-700 mt-4 transition-colors inline-flex items-center gap-1">
                <span>View Saved Jobs</span>
                <span>&rarr;</span>
              </Link>
            </div>

            <Link to="/profile" className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between hover:border-slate-300 transition-colors group min-w-0">
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-slate-700 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-100 transition-colors">
                  <HiOutlineUser size={22} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg md:text-xl font-semibold text-slate-900 truncate">Update Profile</h3>
                  <p className="text-base font-medium text-slate-600 mt-0.5 truncate">Keep it current</p>
                </div>
              </div>
              <div className="text-sm font-semibold text-blue-600 group-hover:text-blue-700 mt-4 transition-colors inline-flex items-center gap-1">
                <span>Edit Profile</span>
                <span>&rarr;</span>
              </div>
            </Link>

            <Link to="/jobs" className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between hover:border-slate-300 transition-colors group min-w-0">
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-slate-700 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-100 transition-colors">
                  <HiOutlineBriefcase size={22} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg md:text-xl font-semibold text-slate-900 truncate">Find Jobs</h3>
                  <p className="text-base font-medium text-slate-600 mt-0.5 truncate">Browse openings</p>
                </div>
              </div>
              <div className="text-sm font-semibold text-blue-600 group-hover:text-blue-700 mt-4 transition-colors inline-flex items-center gap-1">
                <span>Explore Openings</span>
                <span>&rarr;</span>
              </div>
            </Link>
          </>
        )}
      </div>

      {/* Recommended Jobs */}
      <div>
        <div className="flex items-center justify-between mt-6 mb-3">
          <h2 className="text-base font-bold text-slate-900">Recent Jobs</h2>
          <Link to="/jobs" className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline">
            View all &rarr;
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <PageSkeleton key={i} variant="card" />
            ))
          ) : recentJobs.length === 0 ? (
            <div className="col-span-full bg-slate-50 rounded-xl border border-dashed border-slate-200 p-6 text-center max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[250px]">
              <h3 className="text-xl font-semibold text-slate-900 mb-2">You haven't matched with any jobs yet</h3>
              <p className="text-slate-600 text-sm mb-4 max-w-sm">Keep your profile updated so we can surface the best opportunities for you.</p>
              <Link to="/profile" className="btn-primary inline-flex items-center">
                Complete Profile
              </Link>
            </div>
          ) : (
            recentJobs.slice(0, 6).map((job) => (
              <JobCard key={job._id} job={job} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
