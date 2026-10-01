import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAuthenticatedHomePath } from '../utils/rbac';
import PageSkeleton from '../components/PageSkeleton';

export default function ProtectedRoute({ children, role }) {
  const { user, loading, networkError } = useAuth();

  if (loading || networkError) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role && user.role !== role) {
    return <Navigate to={getAuthenticatedHomePath(user)} replace />;
  }

  return children;
}
