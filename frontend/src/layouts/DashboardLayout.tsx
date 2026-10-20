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
  Bell,
  Menu,
  LogOut,
  ChevronLeft,
  Building2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import clsx from 'clsx';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, permission: 'attendance.view' },
  { to: '/employees', label: 'Employees', icon: Users, permission: 'employees.view' },
  { to: '/resorts', label: 'Locations', icon: MapPin, permission: 'locations.view' },
  { to: '/attendance', label: 'Attendance', icon: CalendarDays, permission: 'attendance.view' },
  { to: '/devices', label: 'Devices', icon: Fingerprint, permission: 'devices.manage' },
  { to: '/reports', label: 'Reports', icon: FileBarChart2, permission: 'reports.view' },
  { to: '/settings', label: 'Settings', icon: Settings, permission: 'settings.manage' },
];

export default function DashboardLayout() {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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
        <div className="flex items-center gap-3 px-4 h-16 border-b border-white/10">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-tdcp-green shrink-0">
            <Building2 className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-display text-sm font-bold tracking-wide truncate">TDCP</p>
              <p className="text-[11px] text-white/60 truncate">Attendance System</p>
            </div>
          )}
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
            <div>
              <p className="text-xs text-slate-500">Tourism Development Corporation of Punjab</p>
              <p className="text-sm font-semibold text-tdcp-navy">Universal Attendance</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button type="button" className="relative p-2 rounded-lg hover:bg-tdcp-surface text-slate-600">
              <Bell className="h-5 w-5" />
            </button>
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
