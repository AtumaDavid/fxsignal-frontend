import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { BrandGlyph } from '../components/ui/Brand';
import { useAuth } from '../lib/auth';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <div className="splash" role="status">
        <BrandGlyph />
        Loading your workspace
      </div>
    );
  }
  if (!user)
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
