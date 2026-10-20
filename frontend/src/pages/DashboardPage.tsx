import { useEffect, useState } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  CalendarOff,
  AlertTriangle,
  Wifi,
  WifiOff,
  Percent,
} from 'lucide-react';
import { api, getErrorMessage } from '../services/api';
import type { ApiResponse, DashboardStats } from '../types';

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: typeof Users;
  accent: string;
}) {
  return (
    <div className="rounded-xl bg-white border border-tdcp-border p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 font-display text-2xl font-bold text-tdcp-navy">{value}</p>
        </div>
        <div className={`rounded-lg p-2.5 ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await api.get<ApiResponse<DashboardStats>>('/dashboard/stats');
        setStats(data.data);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-tdcp-navy">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Live attendance overview · {stats?.date ?? '—'} · Asia/Karachi
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-500">Loading dashboard…</div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              label="Total Employees"
              value={stats.totalEmployees}
              icon={Users}
              accent="bg-tdcp-navy/10 text-tdcp-navy"
            />
            <StatCard
              label="Present"
              value={stats.present}
              icon={UserCheck}
              accent="bg-tdcp-green/10 text-tdcp-green"
            />
            <StatCard
              label="Absent"
              value={stats.absent}
              icon={UserX}
              accent="bg-red-50 text-red-600"
            />
            <StatCard
              label="Attendance %"
              value={`${stats.attendancePercentage}%`}
              icon={Percent}
              accent="bg-tdcp-accent/15 text-tdcp-accent"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              label="Late Arrivals"
              value={stats.late}
              icon={Clock}
              accent="bg-orange-50 text-orange-600"
            />
            <StatCard
              label="On Leave"
              value={stats.onLeave}
              icon={CalendarOff}
              accent="bg-sky-50 text-sky-600"
            />
            <StatCard
              label="Missing Punches"
              value={stats.missingPunch}
              icon={AlertTriangle}
              accent="bg-yellow-50 text-yellow-700"
            />
            <StatCard
              label="Locations"
              value={stats.resortCount}
              icon={Users}
              accent="bg-slate-100 text-slate-700"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl bg-white border border-tdcp-border p-5 shadow-sm">
              <h2 className="font-display font-semibold text-tdcp-navy mb-4">Device Connectivity</h2>
              <div className="flex gap-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-tdcp-green/10 p-2 text-tdcp-green">
                    <Wifi className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-tdcp-navy">{stats.onlineDevices}</p>
                    <p className="text-xs text-slate-500">Online</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-red-50 p-2 text-red-600">
                    <WifiOff className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-tdcp-navy">{stats.offlineDevices}</p>
                    <p className="text-xs text-slate-500">Offline / Unknown</p>
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-2xl font-bold text-tdcp-navy">{stats.totalDevices}</p>
                  <p className="text-xs text-slate-500">Total devices</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-white border border-tdcp-border p-5 shadow-sm">
              <h2 className="font-display font-semibold text-tdcp-navy mb-2">System Notes</h2>
              <ul className="text-sm text-slate-600 space-y-2 list-disc list-inside">
                <li>Each resort uses separate physical MySQL attendance tables.</li>
                <li>Head Office can consolidate reports across all locations.</li>
                <li>Biometric adapters are modular — ZKTeco live pull pending on-site verification.</li>
                <li>Mobile attendance is disabled by default.</li>
              </ul>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
