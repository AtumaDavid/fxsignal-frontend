import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import { BrandGlyph } from './ui/Brand';
import { NotificationsBell } from './NotificationsBell';
import { useAuth } from '../lib/auth';
import { DashboardProvider, useDashboard } from '../lib/dashboard';
import { JournalProvider, useJournal } from '../lib/journal';
import {
  PAIRS,
  price,
  signedPercent,
  time,
  tzLabel,
  useNow,
} from '../lib/format';
import { usePrefs } from '../lib/prefs';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
}

const MARKET_NAV: NavItem[] = [
  { to: '/app', label: 'Overview', icon: 'grid', end: true },
  { to: '/app/signals', label: 'Signals', icon: 'signal' },
  { to: '/app/outlook', label: 'Week ahead', icon: 'layers' },
  { to: '/app/calendar', label: 'Calendar', icon: 'calendar' },
  { to: '/app/performance', label: 'Performance', icon: 'activity' },
  { to: '/app/journal', label: 'My journal', icon: 'book' },
];

const ACCOUNT_NAV: NavItem[] = [
  { to: '/app/billing', label: 'Plan & billing', icon: 'card' },
  { to: '/app/settings', label: 'Settings', icon: 'settings' },
  { to: '/app/methodology', label: 'Methodology', icon: 'info' },
];

const TITLES: Record<string, string> = {
  '/app': 'Overview',
  '/app/signals': 'Signals',
  '/app/outlook': 'Week ahead',
  '/app/calendar': 'Calendar',
  '/app/performance': 'Performance',
  '/app/journal': 'My journal',
  '/app/billing': 'Plan & billing',
  '/app/settings': 'Settings',
  '/app/methodology': 'Methodology',
};

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout } = useAuth();
  const { data } = useDashboard();
  const isPro = user?.plan === 'PRO';
  const signalCount = data?.predictions.length ?? 0;
  const { data: journal } = useJournal();

  const renderItem = (item: NavItem) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
      onClick={onClose}
    >
      <Icon name={item.icon} size={16} />
      {item.label}
      {item.to === '/app/signals' && signalCount > 0 && (
        <span className="nav-meta">{signalCount}</span>
      )}
      {item.to === '/app/journal' && (journal?.summary.open ?? 0) > 0 && (
        <span className="nav-meta">{journal?.summary.open} open</span>
      )}
      {item.to === '/app/outlook' && data?.marketStatus === 'CLOSED' && (
        <span className="nav-meta-pill">Weekend</span>
      )}
    </NavLink>
  );

  return (
    <>
      {open && (
        <div className="sidebar-scrim" onClick={onClose} aria-hidden="true" />
      )}
      <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Primary">
        <div className="sidebar-top">
          <NavLink to="/app" className="brand" onClick={onClose}>
            <BrandGlyph />
            FXSignal
          </NavLink>
          <button
            className="icon-btn sidebar-close"
            onClick={onClose}
            aria-label="Close menu"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        <nav className="nav-group" aria-label="Market">
          {MARKET_NAV.map(renderItem)}
        </nav>
        <nav className="nav-group" aria-label="Account">
          <div className="nav-heading">Account</div>
          {ACCOUNT_NAV.map(renderItem)}
        </nav>

        <div className="sidebar-foot">
          {!isPro && (
            <div className="upsell">
              <strong>Free plan · 7-day history</strong>
              <p>
                Pro keeps a full year of settled signals and the performance
                breakdown.
              </p>
              <NavLink
                to="/app/billing"
                className="btn btn-secondary btn-sm btn-block"
                onClick={onClose}
              >
                See Pro
              </NavLink>
            </div>
          )}
          <div className="account-chip">
            <span className="avatar">{initials(user?.name ?? '')}</span>
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
    </>
  );
}

function Clock() {
  const { timeZone } = usePrefs();
  const now = useNow(15_000);
  return (
    <div className="clock" title="Market sessions are scheduled in UTC">
      <span className="num">{time(new Date(now), 'utc')}</span>
      <span className="faint">UTC</span>
      {timeZone === 'local' && tzLabel('local') !== 'UTC' && (
        <span className="clock-date faint">
          · <span className="num">{time(new Date(now), 'local')}</span>{' '}
          {tzLabel('local')}
        </span>
      )}
    </div>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const location = useLocation();
  const { data } = useDashboard();
  const open = data?.marketStatus === 'OPEN';
  return (
    <header className="topbar">
      <button
        className="icon-btn topbar-menu"
        onClick={onMenu}
        aria-label="Open menu"
      >
        <Icon name="menu" size={18} />
      </button>
      <span className="topbar-title">
        {TITLES[location.pathname] ?? 'FXSignal'}
      </span>
      <div className="ticker" aria-label="Last prices">
        {PAIRS.map((pair, index) => {
          const quote = data?.prices.find((p) => p.pairCode === pair);
          const change = quote?.changePercent ?? null;
          return (
            <div
              key={pair}
              className={`ticker-item${index > 0 ? ' secondary' : ''}`}
            >
              <b>{pair}</b>
              <span className="num">{price(pair, quote?.price)}</span>
              <span
                className={`num ${change === null ? 'faint' : change >= 0 ? 'up' : 'down'}`}
              >
                {signedPercent(change)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="clock" style={{ gap: 7 }}>
        <span className={`dot ${open ? 'dot-live' : ''}`} />
        <span>
          {data
            ? open
              ? (data.killzoneLabel ?? 'Market open')
              : 'Market closed'
            : '—'}
        </span>
      </div>
      <Clock />
      <NotificationsBell />
    </header>
  );
}

function Shell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="shell">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="main">
        <Topbar onMenu={() => setMenuOpen(true)} />
        <main className="content" id="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function AppLayout() {
  return (
    <DashboardProvider>
      <JournalProvider>
        <Shell />
      </JournalProvider>
    </DashboardProvider>
  );
}
