import { useEffect, useState, type FormEvent } from 'react';
import { api, getErrorMessage } from '../services/api';
import type { ApiResponse, Employee, Resort } from '../types';
import { useAuth } from '../contexts/AuthContext';

export default function EmployeesPage() {
  const { hasPermission } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [resorts, setResorts] = useState<Resort[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    employeeCode: '',
    firstName: '',
    lastName: '',
    designation: '',
    email: '',
    currentResortId: '',
  });

  async function load() {
    try {
      const [empRes, resortRes] = await Promise.all([
        api.get<ApiResponse<Employee[]>>('/employees', { params: { search: search || undefined } }),
        api.get<ApiResponse<Resort[]>>('/resorts'),
      ]);
      setEmployees(empRes.data.data);
      setResorts(resortRes.data.data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/employees', {
        ...form,
        email: form.email || null,
        designation: form.designation || null,
      });
      setShowForm(false);
      setForm({
        employeeCode: '',
        firstName: '',
        lastName: '',
        designation: '',
        email: '',
        currentResortId: '',
      });
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-tdcp-navy">Employees</h1>
          <p className="text-sm text-slate-500 mt-1">Permanent employee IDs with posting history</p>
        </div>
        {hasPermission('employees.manage') && (
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="rounded-lg bg-tdcp-navy text-white text-sm font-semibold px-4 py-2 hover:bg-tdcp-navy-light"
          >
            {showForm ? 'Cancel' : 'Add Employee'}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={(e) => void onCreate(e)}
          className="rounded-xl bg-white border border-tdcp-border p-5 grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <input
            className="rounded-lg border border-tdcp-border px-3 py-2 text-sm"
            placeholder="Employee code (e.g. TDCP-1025)"
            value={form.employeeCode}
            onChange={(e) => setForm({ ...form, employeeCode: e.target.value })}
            required
          />
          <input
            className="rounded-lg border border-tdcp-border px-3 py-2 text-sm"
            placeholder="First name"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            required
          />
          <input
            className="rounded-lg border border-tdcp-border px-3 py-2 text-sm"
            placeholder="Last name"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            required
          />
          <input
            className="rounded-lg border border-tdcp-border px-3 py-2 text-sm"
            placeholder="Designation"
            value={form.designation}
            onChange={(e) => setForm({ ...form, designation: e.target.value })}
          />
          <input
            className="rounded-lg border border-tdcp-border px-3 py-2 text-sm"
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <select
            className="rounded-lg border border-tdcp-border px-3 py-2 text-sm"
            value={form.currentResortId}
            onChange={(e) => setForm({ ...form, currentResortId: e.target.value })}
            required
          >
            <option value="">Select location</option>
            {resorts.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="md:col-span-3 rounded-lg bg-tdcp-green text-white text-sm font-semibold py-2.5"
          >
            Create employee
          </button>
        </form>
      )}

      <div className="flex gap-2">
        <input
          className="rounded-lg border border-tdcp-border px-3 py-2 text-sm flex-1 max-w-md"
          placeholder="Search by code, name, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void load()}
        />
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-tdcp-border bg-white px-4 py-2 text-sm font-medium"
        >
          Search
        </button>
      </div>

      <div className="rounded-xl bg-white border border-tdcp-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-tdcp-surface text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Designation</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="border-t border-tdcp-border hover:bg-tdcp-surface/60">
                  <td className="px-4 py-3 font-medium text-tdcp-navy">{e.employeeCode}</td>
                  <td className="px-4 py-3">
                    {e.firstName} {e.lastName}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{e.designation ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{e.resortName ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-tdcp-green/10 text-tdcp-green px-2.5 py-0.5 text-xs font-medium capitalize">
                      {e.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!employees.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No employees found
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
