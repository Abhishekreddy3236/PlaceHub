import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAuthenticatedHomePath } from '../utils/rbac';
import PageSkeleton from '../components/PageSkeleton';

export default function HrRoute({ children }) {
  const { user, loading, networkError } = useAuth();
  const location = useLocation();

  if (loading || networkError) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role === 'admin') {
    return <Navigate to={user?.mustChangePassword ? '/admin/change-password' : '/admin'} replace />;
  }

  if (user?.role !== 'hr') {
    return <Navigate to={getAuthenticatedHomePath(user)} replace />;
  }

  if (user?.mustChangePassword && location.pathname !== '/hr/change-password') {
    return <Navigate to="/hr/change-password" replace />;
  }

  return children;
}
