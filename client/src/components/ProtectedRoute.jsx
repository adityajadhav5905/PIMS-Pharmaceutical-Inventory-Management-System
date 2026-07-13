import { Navigate } from 'react-router-dom';

/** Client-side route protection. Redirects to login if unauthenticated; redirects to dashboard if unauthorized. */
export default function ProtectedRoute({ children, adminOnly = false }) {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Enforce admin-only access check
  if (adminOnly && user?.role !== 'Admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
