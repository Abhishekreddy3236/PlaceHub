import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/rbac';
import Logo from '../ui/Logo';
import LogoutConfirmModal from '../ui/LogoutConfirmModal';
import { HiOutlineBookmark, HiOutlineBriefcase, HiOutlineChartBar, HiOutlineClipboardCheck, HiOutlineCog, HiOutlineGlobeAlt, HiOutlineHome, HiOutlineLogout, HiOutlineShieldCheck, HiOutlineUser, HiOutlineUsers } from 'react-icons/hi';
import { useQuery } from '@tanstack/react-query';
import { DASHBOARD_QUERY_KEY, CACHE_TIMES } from '../../services/queryClient';
import { getDashboardData } from '../../services/dashboardService';
import { GLOBAL_APPLICANTS_ENABLED } from '../../config/features';
import { formatDisplayName } from '../../utils/nameFormatter';

export const studentLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: HiOutlineHome },
  { to: '/jobs', label: 'Jobs', icon: HiOutlineBriefcase },
  { to: '/my-applications', label: 'Applications', icon: HiOutlineClipboardCheck },
  { to: '/saved-jobs', label: 'Saved Jobs', icon: HiOutlineBookmark },
  { to: '/profile', label: 'Profile', icon: HiOutlineUser },
];

const adminLinks = [
  { to: '/admin', label: 'Dashboard', icon: HiOutlineChartBar },
  { to: '/admin/jobs', label: 'Manage Jobs', icon: HiOutlineBriefcase },
  { to: '/admin/students', label: 'Students', icon: HiOutlineUser },
  ...(GLOBAL_APPLICANTS_ENABLED ? [{ to: '/admin/applicants', label: 'Applicants', icon: HiOutlineUsers }] : []),
  { to: '/admin/staff', label: 'Staff', icon: HiOutlineUsers },
  { to: '/admin/access-control', label: 'Access Control', icon: HiOutlineClipboardCheck },
  { to: '/admin/config', label: 'Registration', icon: HiOutlineGlobeAlt },
  { to: '/admin/whitelist', label: 'Whitelist', icon: HiOutlineShieldCheck },
  { to: '/admin/change-password', label: 'Settings', icon: HiOutlineCog },
];

const hrLinks = [
  { to: '/hr/applicants', label: 'Applicants', icon: HiOutlineUsers },
  { to: '/hr/change-password', label: 'Settings', icon: HiOutlineCog },
];

const getStaffLinks = (user) => {
  const links = [];

  if (hasPermission(user, 'users', 'read')) {
    links.push({ to: '/admin/students', label: 'Students', icon: HiOutlineUser });
  }

  if (hasPermission(user, 'jobs', 'read')) {
    links.push({ to: '/admin/jobs', label: 'Jobs', icon: HiOutlineBriefcase });
  }

  if (GLOBAL_APPLICANTS_ENABLED && hasPermission(user, 'applications', 'read')) {
    links.push({ to: '/admin/applicants', label: 'Applicants', icon: HiOutlineUsers });
  }

  if (hasPermission(user, 'accessControl', 'read')) {
    links.push({ to: '/admin/access-control', label: 'Access Control', icon: HiOutlineClipboardCheck });
  }

  links.push({ to: '/change-password', label: 'Settings', icon: HiOutlineCog });
  return links;
};

export default function Sidebar({ open, onClose, hideOnMobile }) {
  const { user, loading, logout, isLoggingOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const { data: dashboardData } = useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const response = await getDashboardData({ signal });
      return response.data?.data || {};
    },
    enabled: user?.role === 'student',
    staleTime: CACHE_TIMES?.dashboard || 300000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const unreadCount = dashboardData?.unreadCount || 0;

  if (loading) {
    return (
      <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </aside>
    );
  }

  if (!user) {
    return null;
  }

  const links =
    user?.role === 'admin'
      ? adminLinks
      : user?.role === 'hr'
        ? hrLinks
        : user?.role === 'staff'
          ? getStaffLinks(user)
          : studentLinks;

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isActive = (path) => {
    if (path === '/admin' || path === '/dashboard' || path === '/change-password') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const displayName = formatDisplayName(user);
  const showSecondaryEmail = user?.role === 'student';

  return (
    <>
      {open && !hideOnMobile && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white opacity-100 border-r border-slate-200 shadow-lg flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto ${
          open ? 'translate-x-0' : '-translate-x-full'
        } ${hideOnMobile ? 'hidden lg:flex' : ''}`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 py-4 border-b border-slate-200 flex-shrink-0">
          <Link to="/">
            <Logo className="h-7" />
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-5 space-y-2 overflow-y-auto">
          {links.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.to);
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-md transition group ${
                  active
                    ? 'bg-white text-blue-600 font-semibold shadow-sm border-l-2 border-blue-600'
                    : 'font-medium text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="relative">
                  <Icon size={18} className={`text-slate-500 ${active ? 'text-blue-600' : 'group-hover:text-slate-700'}`} />
                  {link.to === '/my-applications' && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                  )}
                </div>
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* User section + Logout */}
        <div className="border-t border-slate-200 p-4 mt-4 pt-4 flex-shrink-0">
          <div className="flex items-center gap-3 mb-3 px-1">
            <div className="w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center border border-slate-200">
              <span className="text-sm font-medium text-slate-700">
                {displayName?.charAt(0)?.toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-700 font-medium truncate" title={displayName}>{displayName}</p>
              {showSecondaryEmail && (
                <p className="text-slate-500 text-xs truncate">
                  {user?.email || user?.username}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowLogoutModal(true)}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-red-600 transition mt-2 px-1 w-full"
          >
            <HiOutlineLogout size={18} className="text-slate-500 group-hover:text-red-600" />
            Logout
          </button>
        </div>
      </aside>

      <LogoutConfirmModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
        loading={isLoggingOut}
      />
    </>
  );
}
