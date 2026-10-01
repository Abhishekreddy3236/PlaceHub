import { useState, Suspense, useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import Sidebar from './Sidebar';
import { HiMenu } from 'react-icons/hi';
import { useAuth } from '../../context/AuthContext';
import BottomNavigation from './BottomNavigation';
import PageSkeleton from '../PageSkeleton';
import { usePushNotifications } from '../../hooks/usePushNotifications';

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/jobs': 'Browse Jobs',
  '/my-applications': 'My Applications',
  '/saved-jobs': 'Saved Jobs',
  '/profile': 'Profile',
  '/unauthorized': 'Unauthorized',
  '/admin': 'Admin Dashboard',
  '/admin/jobs': 'Manage Jobs',
  '/admin/jobs/new': 'Create Job',
  '/admin/students': 'Students',
  '/admin/staff': 'Staff Management',
  '/admin/applicants': 'All Applicants',
  '/admin/access-control': 'Access Control',
  '/admin/config': 'Registration Settings',
  '/admin/change-password': 'Settings',
  '/change-password': 'Change Password',
  '/hr/applicants': 'Applicants',
  '/hr/change-password': 'Settings',
};

export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();

  const { isSupported, permission, subscribeToPush } = usePushNotifications();
  const hasSynced = useRef(false);

  const navType = useNavigationType();
  const mainRef = useRef(null);
  const scrollRef = useRef(0);
  const restoreTargetRef = useRef(null);

  useEffect(() => {
    if (user?.role !== 'student') {
      return;
    }

    if (isSupported && permission === 'granted' && !hasSynced.current) {
      hasSynced.current = true;
      subscribeToPush().catch(() => { });
    }
  }, [user?.role, isSupported, permission, subscribeToPush]);

  useLayoutEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
  }, []);

  const getPageTitle = () => {
    if (pageTitles[location.pathname]) return pageTitles[location.pathname];
    if (location.pathname.match(/^\/admin\/jobs\/[^/]+\/edit$/)) return 'Edit Job';
    if (location.pathname.match(/^\/admin\/jobs\/[^/]+\/applicants$/)) return 'View Applicants';
    if (location.pathname.match(/^\/jobs\/[^/]+$/)) return 'Job Details';
    return 'PlaceHub';
  };

  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main) return;

    let observer = null;

    const attemptRestore = (targetPosition) => {
      const prevBehavior = main.style.scrollBehavior;
      main.style.scrollBehavior = 'auto';
      main.scrollTop = targetPosition;
      main.style.scrollBehavior = prevBehavior;

      scrollRef.current = main.scrollTop;
    };

    const yieldControl = () => {
      if (observer) {
        observer.disconnect();
        observer = null;
      }

      restoreTargetRef.current = null;

      main.removeEventListener('wheel', yieldControl);
      main.removeEventListener('touchmove', yieldControl);
      main.removeEventListener('pointerdown', yieldControl);
      main.removeEventListener('keydown', handleKeyDown);
    };

    const handleKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) {
        yieldControl();
      }
    };

    if (navType === 'POP') {
      let savedScroll = 0;
      try {
        savedScroll = parseInt(sessionStorage.getItem(`scroll-${location.key}`), 10);
      } catch (e) {
      }

      if (savedScroll > 0) {
        attemptRestore(savedScroll);

        if (main.scrollTop < savedScroll) {
          restoreTargetRef.current = savedScroll;
          observer = new ResizeObserver(() => {
            attemptRestore(savedScroll);

            if (main.scrollTop >= savedScroll - 2) {
              yieldControl();
            }
          });

          if (main.firstElementChild) {
            observer.observe(main.firstElementChild);
          }

          main.addEventListener('wheel', yieldControl, { passive: true });
          main.addEventListener('touchmove', yieldControl, { passive: true });
          main.addEventListener('pointerdown', yieldControl, { passive: true });
          main.addEventListener('keydown', handleKeyDown, { passive: true });
        }
      }
    } else {
      attemptRestore(0);
      scrollRef.current = 0;
    }

    const handleScroll = () => {
      scrollRef.current = main.scrollTop;
    };

    main.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      main.removeEventListener('scroll', handleScroll);

      const finalSaveValue = restoreTargetRef.current !== null
        ? restoreTargetRef.current
        : scrollRef.current;

      yieldControl();

      try {
        sessionStorage.setItem(`scroll-${location.key}`, finalSaveValue);
      } catch (e) {
      }
    };
  }, [location.key, navType]);

  return (
    <div className="flex h-[100dvh] bg-slate-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} hideOnMobile={user?.role === 'student'} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className={`lg:hidden p-2 -ml-2 mr-3 rounded-lg text-slate-500 hover:bg-slate-100 ${user?.role === 'student' ? 'hidden' : ''}`}
          >
            <HiMenu size={20} />
          </button>
          <h1 className="text-base font-semibold tracking-tight text-slate-900">{getPageTitle()}</h1>
        </header>

        {/* Main content */}
        <main ref={mainRef} className={`flex-1 overflow-y-auto p-6 ${user?.role === 'student' ? 'pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-6' : ''}`}>
          <div className="max-w-7xl mx-auto">
            <Suspense fallback={<PageSkeleton variant="route" />}>
              {children}
            </Suspense>
          </div>
        </main>
        {user?.role === 'student' && <BottomNavigation />}
      </div>
    </div>
  );
}
