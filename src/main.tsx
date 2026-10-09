import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { AuthProvider } from './lib/auth';
import { PrefsProvider } from './lib/prefs';
import { TooltipLayer } from './components/ui/TooltipLayer';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import TrackRecord from './pages/TrackRecord';
import { ProtectedRoute } from './pages/ProtectedRoute';
import Overview from './pages/app/Overview';
import Signals from './pages/app/Signals';
import Outlook from './pages/app/Outlook';
import Calendar from './pages/app/Calendar';
import Performance from './pages/app/Performance';
import Billing from './pages/app/Billing';
import Settings from './pages/app/Settings';
import Methodology from './pages/app/Methodology';
import MyJournal from './pages/app/MyJournal';
import Recap from './pages/app/Recap';
import Notifications from './pages/app/Notifications';
import Admin from './pages/app/Admin';
import { AdminLayout } from './components/AdminLayout';
import './index.css';
import { registerServiceWorker } from './lib/push';

/**
 * VITE_ADMIN_ONLY=1 builds an admin-only site: only /login and /admin exist.
 * Deploy it as a second project on an admin-only domain for full separation;
 * the API still enforces ADMIN_EMAILS on every /api/admin call.
 */
const ADMIN_ONLY = import.meta.env.VITE_ADMIN_ONLY === '1';

registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <PrefsProvider>
        <TooltipLayer />
        <BrowserRouter>
          {ADMIN_ONLY ? (
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Admin />} />
              </Route>
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          ) : (
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/track-record" element={<TrackRecord />} />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Admin />} />
              </Route>
              <Route
                path="/app"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Overview />} />
                <Route path="signals" element={<Signals />} />
                <Route path="outlook" element={<Outlook />} />
                <Route path="calendar" element={<Calendar />} />
                <Route path="performance" element={<Performance />} />
                <Route path="journal" element={<MyJournal />} />
                <Route path="recap" element={<Recap />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="admin" element={<Navigate to="/admin" replace />} />
                <Route path="billing" element={<Billing />} />
                <Route path="settings" element={<Settings />} />
                <Route path="methodology" element={<Methodology />} />
                <Route path="*" element={<Navigate to="/app" replace />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}
        </BrowserRouter>
      </PrefsProvider>
    </AuthProvider>
  </StrictMode>
);
