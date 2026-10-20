import { useEffect, useState } from 'react';
import { api, getErrorMessage } from '../services/api';
import type { ApiResponse, Resort } from '../types';

interface AttendanceRow {
  employeeCode: string;
  employeeName: string;
  resortName: string;
  attendanceDate: string;
  status: string;
  checkIn?: string;
  checkOut?: string;
  lateMinutes: number;
}

export default function AttendancePage() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [resortId, setResortId] = useState('');
  const [resorts, setResorts] = useState<Resort[]>([]);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    void api.get<ApiResponse<Resort[]>>('/resorts').then((r) => setResorts(r.data.data));
  }, []);

  async function load() {
    setError('');
    try {
      const { data } = await api.get<
        ApiResponse<{ rows: AttendanceRow[]; summary: Record<string, number> }>
      >('/reports/attendance', {
        params: {
          dateFrom,
          dateTo,
          resortId: resortId || undefined,
        },
      });
      setRows(data.data.rows);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-tdcp-navy">Attendance Register</h1>
        <p className="text-sm text-slate-500 mt-1">
          Consolidated view across resort-specific tables (Asia/Karachi)
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm">
          <span className="block text-slate-600 mb-1">From</span>
          <input
            type="date"
            className="rounded-lg border border-tdcp-border px-3 py-2"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="block text-slate-600 mb-1">To</span>
          <input
            type="date"
            className="rounded-lg border border-tdcp-border px-3 py-2"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="block text-slate-600 mb-1">Location</span>
          <select
            className="rounded-lg border border-tdcp-border px-3 py-2 min-w-[200px]"
            value={resortId}
            onChange={(e) => setResortId(e.target.value)}
          >
            <option value="">All authorized</option>
            {resorts.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg bg-tdcp-navy text-white text-sm font-semibold px-4 py-2"
        >
          Apply
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}

      <div className="rounded-xl bg-white border border-tdcp-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-tdcp-surface text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Check-in</th>
                <th className="px-4 py-3">Check-out</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Late (min)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.employeeCode}-${r.attendanceDate}-${i}`} className="border-t border-tdcp-border">
                  <td className="px-4 py-3">{String(r.attendanceDate).slice(0, 10)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.employeeName}</p>
                    <p className="text-xs text-slate-500">{r.employeeCode}</p>
                  </td>
                  <td className="px-4 py-3">{r.resortName}</td>
                  <td className="px-4 py-3">{r.checkIn ? new Date(r.checkIn).toLocaleTimeString() : '—'}</td>
                  <td className="px-4 py-3">{r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : '—'}</td>
                  <td className="px-4 py-3 capitalize">{r.status.replace('_', ' ')}</td>
                  <td className="px-4 py-3">{r.lateMinutes}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No attendance records for the selected range
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
