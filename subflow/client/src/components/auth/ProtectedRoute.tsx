import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<'ADMIN' | 'STAFF' | 'CUSTOMER'>;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-grid">
        <div className="subflow-shell flex flex-col items-center gap-4 px-8 py-7 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf3f1]">
            <Loader2 className="h-6 w-6 animate-spin text-[#173b32]" />
          </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#173b32]">SubFlow</p>
            <p className="mt-2 text-sm text-slate-500">Loading your workspace...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect customer to portal or admin to dashboard
    return <Navigate to={user.role === 'CUSTOMER' ? '/portal' : '/dashboard'} replace />;
  }

  return <>{children}</>;
};
