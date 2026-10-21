import { useEffect, useMemo, useState } from 'react';
import { api, getErrorMessage } from '../services/api';
import type { ApiResponse, Department, Resort } from '../types';
import { fieldClass, FilterField, Filters } from '../components/Filters';
import Pager from '../components/Pager';

interface AttendanceRow {
  employeeCode: string;
  employeeName: string;
  resortName: string;
  departmentName?: string;
  attendanceDate: string;
  status: string;
  checkIn?: string | null;
  checkOut?: string | null;
  lateMinutes: number;
  earlyMinutes?: number;
}

const METHODS = {
  register: {
    label: 'Full register',
    columns: ['name', 'date', 'department', 'checkIn', 'checkOut', 'late', 'absent', 'leave', 'early'],
  },
  check: { label: 'Check-in / Check-out', columns: ['name', 'date', 'department', 'checkIn', 'checkOut'] },
  late: { label: 'Late', columns: ['name', 'date', 'department', 'checkIn', 'late'] },
  absent: { label: 'Absent', columns: ['name', 'date', 'department', 'absent'] },
  leave: { label: 'Leave', columns: ['name', 'date', 'department', 'leave'] },
  early: { label: 'Early departure', columns: ['name', 'date', 'department', 'checkOut', 'early'] },
} as const;

type MethodKey = keyof typeof METHODS;

const PAGE_SIZE = 20;

const COLUMN_LABELS: Record<string, string> = {
  name: 'Employee name',
  date: 'Date',
  department: 'Department',
  checkIn: 'Check in',
  checkOut: 'Check out',
  late: 'Late',
  absent: 'Absent',
  leave: 'Leave',
  early: 'Early',
};

export default function AttendancePage({ heading = 'Attendance Register' }: { heading?: string }) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [resortId, setResortId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState<MethodKey>('register');
  const [resorts, setResorts] = useState<Resort[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    void api.get<ApiResponse<Resort[]>>('/resorts').then((response) => setResorts(response.data.data));
    void api.get<ApiResponse<Department[]>>('/employees/departments').then((response) => setDepartments(response.data.data));
  }, []);

  async function load(nextStatus = status) {
    setError('');
    try {
      const { data } = await api.get<ApiResponse<{ rows: AttendanceRow[] }>>('/reports/attendance', {
        params: {
          dateFrom,
          dateTo,
          resortId: resortId || undefined,
          departmentId: departmentId || undefined,
          status: nextStatus || undefined,
        },
      });
      setRows(data.data.rows);
      setPage(1);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function downloadPdf() {
    setDownloading(true);
    setError('');
    try {
      const response = await api.get('/reports/attendance/pdf', {
        params: {
          dateFrom,
          dateTo,
          resortId: resortId || undefined,
          departmentId: departmentId || undefined,
        },
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `TDCP-attendance-${dateFrom}-to-${dateTo}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  }

  function applyMethod(next: MethodKey) {
    setMethod(next);
    const preset = next === 'late' ? 'late' : next === 'absent' ? 'absent' : next === 'leave' ? 'on_leave' : '';
    setStatus(preset);
    void load(preset);
  }

  const columns = METHODS[method].columns;
  const visible = useMemo(() => {
    if (method === 'early') return rows.filter((row) => Number(row.earlyMinutes ?? 0) > 0);
    return rows;
  }, [rows, method]);
  const paged = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-tdcp-navy">{heading}</h1>
          <p className="text-sm text-slate-500 mt-1">
            Finalized register. {visible.length} records. These rows stay fixed.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={downloading}
            onClick={() => void downloadPdf()}
            className="rounded-lg bg-tdcp-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {downloading ? 'Preparing PDF…' : 'Download PDF'}
          </button>
        </div>
      </div>

      <Filters>
        <FilterField label="Method">
          <select className={fieldClass} value={method} onChange={(e) => applyMethod(e.target.value as MethodKey)}>
            {Object.entries(METHODS).map(([key, item]) => (
              <option key={key} value={key}>{item.label}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="From">
          <input type="date" className={fieldClass} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </FilterField>
        <FilterField label="To">
          <input type="date" className={fieldClass} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </FilterField>
        <FilterField label="TDCP site">
          <select className={fieldClass} value={resortId} onChange={(e) => setResortId(e.target.value)}>
            <option value="">All sites</option>
            {resorts.map((resort) => (
              <option key={resort.id} value={resort.id}>{resort.name}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Department">
          <select className={fieldClass} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Status">
          <select className={fieldClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="present">Present</option>
            <option value="late">Late</option>
            <option value="absent">Absent</option>
            <option value="on_leave">Leave</option>
            <option value="missing_punch">Missing punch</option>
          </select>
        </FilterField>
        <button type="button" onClick={() => void load()} className="rounded-lg bg-tdcp-green text-white text-sm font-semibold px-4 py-2">
          Apply
        </button>
      </Filters>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>}

      <div className="rounded-xl bg-white border border-tdcp-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-tdcp-surface text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="px-4 py-3">{COLUMN_LABELS[column]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((row, index) => (
                <tr key={`${row.employeeCode}-${row.attendanceDate}-${index}`} className="border-t border-tdcp-border">
                  {columns.map((column) => (
                    <td key={column} className="px-4 py-3">{cell(column, row)}</td>
                  ))}
                </tr>
              ))}
              {!visible.length && (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">No rows for this method</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager page={page} total={visible.length} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>
    </div>
  );
}

function formatBusinessDate(value: string) {
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text.slice(0, 10);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(date);
}

function cell(column: string, row: AttendanceRow) {
  if (column === 'name') return row.employeeName;
  if (column === 'date') return formatBusinessDate(row.attendanceDate);
  if (column === 'department') return row.departmentName ?? '—';
  if (column === 'checkIn') return row.checkIn ? new Date(row.checkIn).toLocaleTimeString() : '—';
  if (column === 'checkOut') return row.checkOut ? new Date(row.checkOut).toLocaleTimeString() : '—';
  if (column === 'late') return row.status === 'late' ? `${row.lateMinutes} min` : '—';
  if (column === 'absent') return row.status === 'absent' ? 'Yes' : 'No';
  if (column === 'leave') return row.status === 'on_leave' ? 'Yes' : 'No';
  if (column === 'early') return Number(row.earlyMinutes ?? 0) > 0 ? `${row.earlyMinutes} min` : '—';
  return '—';
}
