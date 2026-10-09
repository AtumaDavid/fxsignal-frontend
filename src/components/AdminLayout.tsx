import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { Icon } from './Icon';
import { BrandGlyph } from './ui/Brand';
import { useAuth } from '../lib/auth';

/**
 * Isolated admin shell, mounted at /admin — outside the main /app layout on
 * purpose. Admins get a separate surface with no market nav, no journal and
 * no upsell, so the owner console never shares chrome with the trading app.
 * Access is still enforced by the API (ADMIN_EMAILS + requireAdmin): this
 * layout only hides the UI, the server is the gate.
 *
 * To run it as a truly separate site (recommended), deploy a second frontend
 * with VITE_ADMIN_ONLY=1 on an admin-only domain (e.g.
 * admin.fxsignal.example) and add that origin to the API's FRONTEND_URL.
 * The API rejects every /api/admin call from non-admin accounts either way.
 */
export function AdminLayout() {
  const { user, logout } = useAuth();
  if (user && !user.isAdmin) return <Navigate to="/app" replace />;

  return (
    <div className="shell" style={{ gridTemplateColumns: '236px minmax(0, 1fr)' }}>
      <aside className="sidebar" aria-label="Admin">
        <div className="sidebar-top">
          <span className="brand">
            <BrandGlyph />
            FXSignal
          </span>
          <span className="tag tag-solid">Admin</span>
        </div>
        <nav className="nav-group" aria-label="Admin">
          <NavLink to="/admin" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <Icon name="shield" size={16} />
            Overview
          </NavLink>
          <NavLink to="/app" className="nav-link">
            <Icon name="arrowLeft" size={16} />
            Back to app
          </NavLink>
        </nav>
        <div className="sidebar-foot">
          <div className="account-chip">
            <span className="avatar">
              {(user?.name ?? '?').slice(0, 1).toUpperCase()}
            </span>
            <div className="account-chip-copy">
              <strong>{user?.name}</strong>
              <span>{user?.email}</span>
            </div>
            <button
              className="icon-btn"
              onClick={() => void logout()}
              aria-label="Sign out"
              title="Sign out"
            >
              <Icon name="logout" size={15} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main">
        <main className="content" id="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
