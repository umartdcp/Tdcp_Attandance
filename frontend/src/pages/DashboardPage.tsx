import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { ApiResponse, Resort } from '../types';
import { useLive } from '../contexts/LiveContext';
import { fieldClass, FilterField, Filters } from '../components/Filters';

export default function DashboardPage() {
  const { feed, error, resortId, setResortId } = useLive();
  const [resorts, setResorts] = useState<Resort[]>([]);
  const stats = feed?.stats;

  useEffect(() => {
    void api.get<ApiResponse<Resort[]>>('/resorts').then((response) => setResorts(response.data.data)).catch(() => undefined);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-tdcp-navy">Live dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Refreshes every 12 seconds · {stats?.date ?? 'today'} · Asia/Karachi
          </p>
        </div>
      </div>

      <Filters>
        <FilterField label="TDCP site">
          <select className={fieldClass} value={resortId} onChange={(e) => setResortId(e.target.value)}>
            <option value="">All attached sites</option>
            {resorts.map((resort) => (
              <option key={resort.id} value={resort.id}>{resort.name}</option>
            ))}
          </select>
        </FilterField>
      </Filters>

      {error && <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3">{error}</div>}

      {!stats ? (
        <p className="text-sm text-slate-500">Waiting for the attendance feed…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Employees" value={stats.totalEmployees} />
            <Stat label="Present" value={stats.present} />
            <Stat label="Late" value={stats.late} />
            <Stat label="Absent" value={stats.absent} />
            <Stat label="On leave" value={stats.onLeave} />
            <Stat label="Machines online" value={stats.onlineDevices} />
            <Stat label="Machines offline" value={stats.offlineDevices} />
            <Stat label="TDCP sites" value={stats.resortCount} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl bg-white border border-tdcp-border p-5 shadow-sm">
              <h2 className="font-display font-semibold text-tdcp-navy mb-3">Latest employees</h2>
              <ul className="space-y-2 text-sm">
                {(feed?.recentEmployees ?? []).map((employee) => (
                  <li key={employee.id} className="flex justify-between gap-3 border-b border-tdcp-border pb-2">
                    <span className="font-medium text-tdcp-navy">{employee.name}</span>
                    <span className="text-slate-500">{employee.resortName ?? '—'} · ID {employee.deviceUserId ?? employee.employeeCode}</span>
                  </li>
                ))}
                {!feed?.recentEmployees.length && <li className="text-slate-500">No employees at this site yet</li>}
              </ul>
            </div>
            <div className="rounded-xl bg-white border border-tdcp-border p-5 shadow-sm">
              <h2 className="font-display font-semibold text-tdcp-navy mb-3">Today’s punches</h2>
              <ul className="space-y-2 text-sm">
                {(feed?.recentAttendance ?? []).map((row, index) => (
                  <li key={`${row.employeeName}-${index}`} className="flex justify-between gap-3 border-b border-tdcp-border pb-2">
                    <span>{row.employeeName}</span>
                    <span className="text-slate-500 capitalize">{row.status.replace('_', ' ')} · {row.resortName}</span>
                  </li>
                ))}
                {!feed?.recentAttendance.length && (
                  <li className="text-slate-500">No punches yet today. They appear here when the machine syncs.</li>
                )}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white border border-tdcp-border p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold text-tdcp-navy">{value}</p>
    </div>
  );
}
