import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from './Spinner';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="page-loading">
        <Spinner label="Checking your session" />
        <p>Checking your session…</p>
      </div>
    );
  }

  if (!user) {
    const next = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(next)}`}
        replace
        state={{ notice: 'Sign in to view that page.' }}
      />
    );
  }

  return children;
}
