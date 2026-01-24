import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * Renders children only if the user has one of the allowed roles. Otherwise redirects to /dashboard.
 */
export default function RequireRole({ allowedRoles = [], children }) {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <p className="text-default-500">Loading…</p>
      </div>
    );
  }

  if (!profile || !allowedRoles.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
