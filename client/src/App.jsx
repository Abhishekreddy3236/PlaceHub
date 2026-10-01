import { Suspense, lazy, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import DashboardLayout from './components/layout/DashboardLayout';
import ProtectedRoute from './routes/ProtectedRoute';
import AdminRoute from './routes/AdminRoute';
import HrRoute from './routes/HrRoute';
import { useAuth } from './context/AuthContext';
import PageSkeleton from './components/PageSkeleton';
import ErrorBoundary from './components/common/ErrorBoundary';
import SplashScreen from './components/ui/SplashScreen';
import ConnectivityProvider from './components/providers/ConnectivityProvider';
import { GLOBAL_APPLICANTS_ENABLED } from './config/features';
import { getMaintenanceStatus, MAINTENANCE_EVENT_NAME } from './utils/maintenanceEvent';

const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const VerifyOTP = lazy(() => import('./pages/VerifyOTP'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const VerifyResetOTP = lazy(() => import('./pages/VerifyResetOTP'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Unauthorized = lazy(() => import('./pages/Unauthorized'));
const Dashboard = lazy(() => import('./pages/StudentDashboard'));
const Profile = lazy(() => import('./pages/Profile'));
const Jobs = lazy(() => import('./pages/Jobs'));
const JobDetails = lazy(() => import('./pages/JobDetails'));
const SavedJobs = lazy(() => import('./pages/SavedJobs'));
const MyApplications = lazy(() => import('./pages/MyApplications'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const ManageJobs = lazy(() => import('./pages/admin/ManageJobs'));
const JobForm = lazy(() => import('./pages/admin/JobForm'));
const ViewApplicants = lazy(() => import('./pages/admin/ViewApplicants'));
const AllApplicants = lazy(() => import('./pages/admin/AllApplicants'));
const AdminStudents = lazy(() => import('./pages/admin/AdminStudents'));
const StaffManagement = lazy(() => import('./pages/admin/StaffManagement'));
const AccessControl = lazy(() => import('./pages/admin/AccessControl'));
const RegistrationConfig = lazy(() => import('./pages/admin/RegistrationConfig'));
const WhitelistPage = lazy(() => import('./pages/admin/WhitelistPage'));
const ChangePassword = lazy(() => import('./pages/admin/ChangePassword'));
const AdminForgotPassword = lazy(() => import('./pages/admin/AdminForgotPassword'));
const AdminVerifyOTP = lazy(() => import('./pages/admin/AdminVerifyOTP'));
const AdminResetPassword = lazy(() => import('./pages/admin/AdminResetPassword'));
const MaintenancePage = lazy(() => import('./pages/MaintenancePage'));

const RouteSkeleton = () => (
  <div className="min-h-screen" />
);

const MaintenanceProvider = ({ children, onCheckComplete }) => {
  const [isChecking, setIsChecking] = useState(true);
  const [isMaintenance, setIsMaintenance] = useState(getMaintenanceStatus());

  useEffect(() => {
    const handleMaintenance = () => setIsMaintenance(true);
    window.addEventListener(MAINTENANCE_EVENT_NAME, handleMaintenance);
    return () => window.removeEventListener(MAINTENANCE_EVENT_NAME, handleMaintenance);
  }, []);

  useEffect(() => {
    if (getMaintenanceStatus()) {
      setIsChecking(false);
      if (onCheckComplete) onCheckComplete();
      return;
    }

    const checkHealth = async () => {
      try {
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
        await axios.get(`${API_BASE_URL}/health`, {
          headers: { 'Cache-Control': 'no-cache' },
          timeout: 4000
        });
      } catch (error) {
        if (error.response?.status === 503) {
          setIsMaintenance(true);
        }
      } finally {
        setIsChecking(false);
        if (onCheckComplete) onCheckComplete();
      }
    };

    checkHealth();
  }, [onCheckComplete]);

  if (isChecking) {
    return null;
  }

  if (isMaintenance) {
    return <MaintenancePage />;
  }

  return children;
};

const PublicLayout = ({ children }) => {
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  return (
    <>
      {!isAuthPage && <Navbar />}
      <Suspense fallback={<RouteSkeleton />}>
        {children}
      </Suspense>
      {!isAuthPage && <Footer />}
    </>
  );
};

function App() {
  const { user, loading, networkError, isRetrying, retryAuth } = useAuth();
  const [fontsReady, setFontsReady] = useState(false);
  const [isMaintenanceChecking, setIsMaintenanceChecking] = useState(true);

  useEffect(() => {
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        setFontsReady(true);
      });
    } else {
      setFontsReady(true);
    }
  }, []);

  const handleMaintenanceCheckComplete = useCallback(() => {
    setIsMaintenanceChecking(false);
  }, []);

  return (
    <ErrorBoundary>
      <SplashScreen isReady={(!loading || networkError) && fontsReady && !isMaintenanceChecking} />
      <MaintenanceProvider onCheckComplete={handleMaintenanceCheckComplete}>
        <ConnectivityProvider>
          {networkError && fontsReady && (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-zinc-950/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-xl max-w-sm w-full mx-4 text-center">
              <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-6 leading-snug">Please check your internet connection</h3>
              <button
                onClick={retryAuth}
                disabled={isRetrying}
                className={`text-white px-6 py-2.5 rounded-lg font-semibold w-full shadow-sm flex items-center justify-center gap-2 transition-all duration-200 ${
                  isRetrying ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 hover:shadow-md hover:-translate-y-0.5 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2'
                }`}
              >
                {isRetrying && (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {isRetrying ? 'Retrying...' : 'Retry'}
              </button>
            </div>
          </div>
        )}
        <Suspense fallback={<RouteSkeleton />}>
          <div>
            <Routes>
              <Route path="/maintenance" element={<MaintenancePage />} />
              <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
              <Route path="/login" element={<PublicLayout><Login /></PublicLayout>} />
              <Route path="/register" element={<PublicLayout><Register /></PublicLayout>} />
              <Route path="/verify-otp" element={<PublicLayout><VerifyOTP /></PublicLayout>} />
              <Route path="/forgot-password" element={<PublicLayout><ForgotPassword /></PublicLayout>} />
              <Route path="/verify-reset-otp" element={<PublicLayout><VerifyResetOTP /></PublicLayout>} />
              <Route path="/reset-password" element={<PublicLayout><ResetPassword /></PublicLayout>} />

              <Route
                path="/unauthorized"
                element={
                  loading
                    ? <RouteSkeleton />
                    : user
                      ? <DashboardLayout><Unauthorized /></DashboardLayout>
                      : <PublicLayout><Unauthorized /></PublicLayout>
                }
              />

              <Route path="/admin/forgot-password" element={<AdminForgotPassword />} />
              <Route path="/admin/verify-reset-otp" element={<AdminVerifyOTP />} />
              <Route path="/admin/reset-password" element={<AdminResetPassword />} />

              <Route path="/change-password" element={<ProtectedRoute><DashboardLayout><ChangePassword /></DashboardLayout></ProtectedRoute>} />

              <Route path="/dashboard" element={<ProtectedRoute role="student"><DashboardLayout><Dashboard /></DashboardLayout></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute role="student"><DashboardLayout><Profile /></DashboardLayout></ProtectedRoute>} />
              <Route path="/jobs" element={<ProtectedRoute role="student"><DashboardLayout><Jobs /></DashboardLayout></ProtectedRoute>} />
              <Route path="/jobs/:id" element={<ProtectedRoute role="student"><DashboardLayout><JobDetails /></DashboardLayout></ProtectedRoute>} />
              <Route path="/saved-jobs" element={<ProtectedRoute role="student"><DashboardLayout><SavedJobs /></DashboardLayout></ProtectedRoute>} />
              <Route path="/my-applications" element={<ProtectedRoute role="student"><DashboardLayout><MyApplications /></DashboardLayout></ProtectedRoute>} />

              <Route path="/admin" element={<AdminRoute><DashboardLayout><AdminDashboard /></DashboardLayout></AdminRoute>} />
              <Route path="/admin/jobs" element={<AdminRoute resource="jobs"><DashboardLayout><ManageJobs /></DashboardLayout></AdminRoute>} />
              <Route path="/admin/jobs/new" element={<AdminRoute resource="jobs" level="write"><DashboardLayout><JobForm /></DashboardLayout></AdminRoute>} />
              <Route path="/admin/jobs/:id/edit" element={<AdminRoute resource="jobs" level="write"><DashboardLayout><JobForm /></DashboardLayout></AdminRoute>} />
              <Route path="/admin/jobs/:id/applicants" element={<AdminRoute resource="applications"><DashboardLayout><ViewApplicants /></DashboardLayout></AdminRoute>} />
              <Route path="/admin/students" element={<AdminRoute resource="users"><DashboardLayout><AdminStudents /></DashboardLayout></AdminRoute>} />
              <Route path="/admin/staff" element={<AdminRoute adminOnly><DashboardLayout><StaffManagement /></DashboardLayout></AdminRoute>} />
              <Route path="/admin/access-control" element={<AdminRoute resource="accessControl"><DashboardLayout><AccessControl /></DashboardLayout></AdminRoute>} />
              <Route path="/admin/config" element={<AdminRoute adminOnly><DashboardLayout><RegistrationConfig /></DashboardLayout></AdminRoute>} />
              <Route path="/admin/whitelist" element={<AdminRoute adminOnly><DashboardLayout><WhitelistPage /></DashboardLayout></AdminRoute>} />
              {GLOBAL_APPLICANTS_ENABLED && (
                <Route path="/admin/applicants" element={<AdminRoute resource="applications"><DashboardLayout><AllApplicants /></DashboardLayout></AdminRoute>} />
              )}
              <Route path="/admin/change-password" element={<AdminRoute adminOnly><DashboardLayout><ChangePassword /></DashboardLayout></AdminRoute>} />

              <Route path="/hr" element={<HrRoute><Navigate to="/hr/applicants" replace /></HrRoute>} />
              <Route path="/hr/applicants" element={<HrRoute><DashboardLayout><AllApplicants /></DashboardLayout></HrRoute>} />
              <Route path="/hr/change-password" element={<HrRoute><DashboardLayout><ChangePassword /></DashboardLayout></HrRoute>} />

              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </div>
        </Suspense>
        </ConnectivityProvider>
      </MaintenanceProvider>
    </ErrorBoundary>
  );
}

export default App;
