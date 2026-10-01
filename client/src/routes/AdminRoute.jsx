import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasPermission, getAuthenticatedHomePath } from '../utils/rbac';
import PageSkeleton from '../components/PageSkeleton';

export default function AdminRoute({ children, resource, level = 'read', adminOnly = false }) {
  const { user, loading, networkError } = useAuth();
  const location = useLocation();

  if (loading || networkError) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role === 'hr') {
    return <Navigate to={user?.mustChangePassword ? '/hr/change-password' : '/hr/applicants'} replace />;
  }

  if (user?.role === 'staff') {
    if (user?.mustChangePassword && location.pathname !== '/change-password') {
      return <Navigate to="/change-password" replace />;
    }

    if (adminOnly) {
      return <Navigate to={getAuthenticatedHomePath(user)} replace />;
    }

    if (!resource) {
      return <Navigate to={getAuthenticatedHomePath(user)} replace />;
    }

    if (!hasPermission(user, resource, level)) {
      return <Navigate to={getAuthenticatedHomePath(user)} replace />;
    }

    return children;
  }

  if (user?.role !== 'admin') {
    return <Navigate to={getAuthenticatedHomePath(user)} replace />;
  }

  if (user?.mustChangePassword && location.pathname !== '/admin/change-password') {
    return <Navigate to="/admin/change-password" replace />;
  }

  return children;
}
