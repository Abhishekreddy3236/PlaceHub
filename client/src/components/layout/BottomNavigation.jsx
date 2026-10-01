import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DASHBOARD_QUERY_KEY, CACHE_TIMES } from '../../services/queryClient';
import { getDashboardData } from '../../services/dashboardService';
import {
  HiOutlineHome,
  HiOutlineBriefcase,
  HiOutlineClipboardCheck,
  HiOutlineBookmark,
  HiOutlineUser,
} from 'react-icons/hi';

const navItems = [
  { to: '/dashboard', label: 'Home', icon: HiOutlineHome },
  { to: '/jobs', label: 'Jobs', icon: HiOutlineBriefcase },
  { to: '/my-applications', label: 'Applications', icon: HiOutlineClipboardCheck },
  { to: '/saved-jobs', label: 'Saved', icon: HiOutlineBookmark },
  { to: '/profile', label: 'Profile', icon: HiOutlineUser },
];

export default function BottomNavigation() {
  const location = useLocation();

  const { data: dashboardData } = useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const response = await getDashboardData({ signal });
      return response.data?.data || {};
    },
    staleTime: CACHE_TIMES?.dashboard || 300000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const unreadCount = dashboardData?.unreadCount || 0;

  const isActive = (path) => {
    if (path === '/dashboard') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="lg:hidden fixed w-fit max-w-[calc(100%-2rem)] z-50 bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md border border-slate-200/60 shadow-[0_8px_32px_rgba(0,0,0,0.08)] rounded-full px-2 py-1.5">
      <div className="flex items-center justify-center gap-1.5 sm:gap-2">
        {navItems.map((item) => {
          const active = isActive(item.to);
          const Icon = item.icon;

          return (
            <Link
              key={item.to}
              to={item.to}
              className="relative outline-none rounded-full focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1"
              aria-label={item.label}
            >
              <div
                className={`flex items-center justify-center rounded-full transition-colors duration-200 ease-out h-11 w-11 shrink-0 ${active
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/60'
                  }`}
              >
                <div className="relative flex items-center justify-center">
                  <Icon
                    size={24}
                    strokeWidth={2.5}
                    className={`transition-transform duration-200 ease-out ${active ? 'scale-105' : 'scale-100'
                      }`}
                  />
                  {item.to === '/my-applications' && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600 ring-2 ring-white"></span>
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

