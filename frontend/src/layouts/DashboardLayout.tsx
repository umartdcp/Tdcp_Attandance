import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  MapPin,
  Fingerprint,
  CalendarDays,
  FileBarChart2,
  Settings,
  UserCog,
  Bell,
  Menu,
  LogOut,
  ChevronLeft,
  ClipboardList,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { LiveProvider, useLive } from '../contexts/LiveContext';
import Logo from '../components/Logo';
import clsx from 'clsx';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, permission: 'attendance.view' },
  { to: '/setup', label: 'Office setup', icon: ClipboardList, permission: 'locations.view' },
  { to: '/employees', label: 'Employees', icon: Users, permission: 'employees.view' },
  { to: '/sites', label: 'TDCP Sites', icon: MapPin, permission: 'locations.view' },
  { to: '/attendance', label: 'Attendance', icon: CalendarDays, permission: 'attendance.view' },
  { to: '/devices', label: 'Devices', icon: Fingerprint, permission: 'devices.manage' },
  { to: '/reports', label: 'Reports', icon: FileBarChart2, permission: 'reports.view' },
  { to: '/users', label: 'Users and roles', icon: UserCog, permission: 'users.manage' },
  { to: '/settings', label: 'Settings', icon: Settings, permission: 'attendance.view' },
];

export default function DashboardLayout() {
  return (
    <LiveProvider>
      <DashboardShell />
    </LiveProvider>
  );
}

function DashboardShell() {
  const { user, logout, hasPermission } = useAuth();
  const { notices, enableNotifications, clearNotices } = useLive();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);

  const visibleNav = navItems.filter((item) => hasPermission(item.permission));

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-tdcp-surface flex">
      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex flex-col bg-tdcp-navy text-white transition-all duration-300',
          collapsed ? 'w-[72px]' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex items-center gap-3 px-3 h-20 border-b border-white/10">
          <Logo variant="white" className={clsx('object-contain', collapsed ? 'h-10 w-10' : 'h-12 w-full')} />
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                  isActive
                    ? 'bg-tdcp-green text-white'
                    : 'text-white/75 hover:bg-white/10 hover:text-white'
                )
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="hidden lg:flex items-center justify-center h-12 border-t border-white/10 text-white/60 hover:text-white"
        >
          <ChevronLeft className={clsx('h-5 w-5 transition-transform', collapsed && 'rotate-180')} />
        </button>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main */}
      <div className={clsx('flex-1 flex flex-col min-w-0', collapsed ? 'lg:ml-[72px]' : 'lg:ml-64')}>
        <header className="sticky top-0 z-20 h-16 bg-white/90 backdrop-blur border-b border-tdcp-border flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="lg:hidden p-2 rounded-lg hover:bg-tdcp-surface"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <Logo variant="green" className="hidden sm:block h-10 w-auto object-contain" />
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                type="button"
                className="relative p-2 rounded-lg hover:bg-tdcp-surface text-slate-600"
                onClick={() => {
                  enableNotifications();
                  setBellOpen((open) => !open);
                }}
                title="Notifications"
              >
                <Bell className="h-5 w-5" />
                {notices.length > 0 && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-tdcp-green" />
                )}
              </button>
              {bellOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl border border-tdcp-border bg-white shadow-lg p-3 z-30">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-tdcp-navy">Live updates</p>
                    <button type="button" className="text-xs text-tdcp-green" onClick={clearNotices}>
                      Clear
                    </button>
                  </div>
                  {notices.length === 0 ? (
                    <p className="text-sm text-slate-500">No new employees yet. Updates appear here automatically.</p>
                  ) : (
                    <ul className="space-y-2 max-h-64 overflow-auto">
                      {notices.map((notice) => (
                        <li key={notice.id} className="text-sm text-slate-700 border-b border-tdcp-border pb-2">
                          {notice.text}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-tdcp-navy">{user?.username}</p>
              <p className="text-xs text-slate-500">{user?.roleName}</p>
            </div>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="p-2 rounded-lg hover:bg-red-50 text-slate-600 hover:text-red-600"
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
