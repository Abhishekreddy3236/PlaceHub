import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HiOutlineBars3, HiOutlineXMark, HiOutlineArrowDownTray } from 'react-icons/hi2';
import { useAuth } from "../../context/AuthContext";
import { getAuthenticatedHomePath } from '../../utils/rbac';
import { SHOW_TEAM_SECTION } from '../../utils/constants';
import Logo from '../ui/Logo';
import LogoutConfirmModal from '../ui/LogoutConfirmModal';
import { usePWAInstallContext } from '../../context/PWAInstallContext';
import toast from 'react-hot-toast';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [activeSection, setActiveSection] = useState('Home');
  const { user, loading, logout, isLoggingOut } = useAuth();
  const dashboardPath = user ? getAuthenticatedHomePath(user) : '/login';
  const location = useLocation();
  const { canShowInstallHelp, isIOSBrowser, handleInstall, isInstalled, hasInstallPrompt } = usePWAInstallContext();
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    if (location.pathname !== '/') {
      setActiveSection('');
      return;
    }
    const handleScroll = () => {
      const sections = [
        { id: 'contact', name: 'Contact' },
        SHOW_TEAM_SECTION && { id: 'team', name: 'Team' },
        { id: 'about', name: 'About' },
        { id: 'for-students', name: 'For Students' },
      ].filter(Boolean);
      for (const sec of sections) {
        const el = document.getElementById(sec.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 280) {
            setActiveSection(sec.name);
            return;
          }
        }
      }
      setActiveSection('Home');
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
  };

  const openLogoutModal = () => {
    setOpen(false);
    setShowLogoutModal(true);
  };

  const handleAnchorClick = (e, targetId) => {
    e.preventDefault();
    if (location.pathname !== '/') {
      window.location.href = '/#' + targetId;
      return;
    }
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const navLinks = [
    { name: 'Home', path: '/', isAnchor: false },
    { name: 'For Students', path: '#for-students', targetId: 'for-students', isAnchor: true },
    { name: 'About', path: '#about', targetId: 'about', isAnchor: true },
    SHOW_TEAM_SECTION && { name: 'Team', path: '#team', targetId: 'team', isAnchor: true },
    { name: 'Contact', path: '#contact', targetId: 'contact', isAnchor: true },
  ].filter(Boolean);

  return (
    <nav className="bg-white border-b border-slate-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <Logo className="h-8" />
          </Link>

          {/* Center Links */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link, i) => {
              const isActive = activeSection === link.name;
              const linkClass = `text-sm font-semibold transition-colors cursor-pointer ${
                isActive
                  ? 'text-slate-900 border-b-2 border-blue-600 pb-1 pt-1.5'
                  : 'text-slate-900 hover:text-blue-600 pt-0.5'
              }`;

              return link.isAnchor ? (
                <a
                  key={i}
                  href={link.path}
                  onClick={(e) => handleAnchorClick(e, link.targetId)}
                  className={linkClass}
                >
                  {link.name}
                </a>
              ) : (
                <Link
                  key={i}
                  to={link.path}
                  onClick={() => {
                    if (link.path === '/' && location.pathname === '/') {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                  className={linkClass}
                >
                  {link.name}
                </Link>
              );
            })}
          </div>

          {/* Right Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {!isInstalled && canShowInstallHelp && (
              <button
                onClick={() => {
                  if (isIOSBrowser) {
                    setShowIOSModal(true);
                  } else if (hasInstallPrompt) {
                    handleInstall();
                  } else {
                    toast('To install, use the "Install app" option in your browser menu.', { icon: 'ℹ️' });
                  }
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-black rounded-lg shadow-sm hover:shadow-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                title="Install PlaceHub App"
              >
                <HiOutlineArrowDownTray size={18} />
                <span>{isIOSBrowser ? 'Add to Home Screen' : 'Install'}</span>
              </button>
            )}
            {loading ? (
              <div className="h-9 w-40 bg-slate-100 rounded-lg animate-pulse" />
            ) : !user ? (
              <>
                <Link
                  to="/login"
                  className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all shadow-sm"
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  className="px-5 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm"
                >
                  Get Started
                </Link>
              </>
            ) : (
              <>
                <Link
                  to={dashboardPath}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all shadow-sm"
                >
                  Dashboard
                </Link>
                <button
                  onClick={openLogoutModal}
                  className="px-4 py-2.5 text-sm font-semibold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-all"
                >
                  Logout
                </button>
              </>
            )}
          </div>

          {/* Mobile buttons */}
          <div className="md:hidden flex items-center gap-2">
            {!isInstalled && canShowInstallHelp && (
              <button
                onClick={() => {
                  if (isIOSBrowser) {
                    setShowIOSModal(true);
                  } else if (hasInstallPrompt) {
                    handleInstall();
                  } else {
                    toast('To install, use the "Install app" option in your browser menu.', { icon: 'ℹ️' });
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-black rounded-lg shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                title="Install PlaceHub App"
              >
                <HiOutlineArrowDownTray size={18} />
                <span>{isIOSBrowser ? 'Add to Home Screen' : 'Install'}</span>
              </button>
            )}
            <button
              onClick={() => setOpen(!open)}
              className="p-2 text-slate-600"
            >
              {open ? <HiOutlineXMark size={24} /> : <HiOutlineBars3 size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {open && (
        <div className="md:hidden border-t border-slate-100 bg-white">
          <div className="px-4 py-6 space-y-4">
            {navLinks.map((link, i) =>
              link.isAnchor ? (
                <a
                  key={i}
                  href={link.path}
                  onClick={(e) => {
                    setOpen(false);
                    handleAnchorClick(e, link.targetId);
                  }}
                  className="block text-base font-semibold text-slate-900 cursor-pointer"
                >
                  {link.name}
                </a>
              ) : (
                <Link
                  key={i}
                  to={link.path}
                  className="block text-base font-semibold text-slate-900"
                  onClick={() => {
                    setOpen(false);
                    if (link.path === '/' && location.pathname === '/') {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                >
                  {link.name}
                </Link>
              )
            )}
            <div className="pt-6 border-t border-slate-100 flex flex-col gap-3">
              {!user ? (
                <>
                  <Link to="/login" className="px-5 py-3 text-center text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg">
                    Log In
                  </Link>
                  <Link to="/register" className="px-5 py-3 text-center text-sm font-semibold bg-blue-600 text-white rounded-lg">
                    Get Started
                  </Link>
                </>
              ) : (
                <>
                  <Link to={dashboardPath} className="px-5 py-3 text-center text-sm font-semibold bg-blue-600 text-white rounded-lg">
                    Dashboard
                  </Link>
                  <button onClick={openLogoutModal} className="px-5 py-3 text-center text-sm font-semibold text-red-600 bg-red-50 rounded-lg">
                    Logout
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <LogoutConfirmModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
        loading={isLoggingOut}
      />

      {/* iOS Install Helper Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Install PlaceHub</h3>
                <button
                  onClick={() => setShowIOSModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <HiOutlineXMark size={20} />
                </button>
              </div>
              <p className="text-slate-600 text-sm mb-6">
                Install this app on your iOS device for a better experience and instant push notifications.
              </p>
              <ol className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600">
                    1
                  </div>
                  <p className="text-sm text-slate-700">Tap the <strong className="font-semibold text-slate-900">Share</strong> button at the bottom of Safari.</p>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600">
                    2
                  </div>
                  <p className="text-sm text-slate-700">Scroll down and tap <strong className="font-semibold text-slate-900">Add to Home Screen</strong>.</p>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600">
                    3
                  </div>
                  <p className="text-sm text-slate-700">Tap <strong className="font-semibold text-slate-900">Add</strong> in the top right corner.</p>
                </li>
              </ol>
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100">
              <button
                onClick={() => setShowIOSModal(false)}
                className="w-full flex justify-center py-2.5 px-4 border border-slate-300 rounded-xl shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}