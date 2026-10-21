import { useEffect, useState, type FormEvent, type MouseEvent } from 'react';
import { MoreVertical } from 'lucide-react';
import { api, getErrorMessage } from '../services/api';
import type { ApiResponse, Department, Employee, Resort } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { fieldClass, FilterField, Filters } from '../components/Filters';
import ReportUpload from '../components/ReportUpload';
import Pager from '../components/Pager';

interface DeviceOption {
  id: string;
  name: string;
  resortId: string;
  resortName: string;
  adapterCode: string;
}

const PAGE_SIZE = 20;

const emptyForm = {
  deviceId: '',
  deviceUserId: '',
  firstName: '',
  lastName: '',
  departmentName: '',
  shiftStart: '09:00',
  shiftEnd: '17:00',
  gender: 'male',
  fingerStatus: 'not_captured' as 'not_captured' | 'captured' | 'failed',
  currentResortId: '',
};

interface EditDraft {
  firstName: string;
  lastName: string;
  departmentName: string;
  designation: string;
  gender: string;
  shiftStart: string;
  shiftEnd: string;
  currentResortId: string;
}

export default function EmployeesPage() {
  const { hasPermission } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [resorts, setResorts] = useState<Resort[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [search, setSearch] = useState('');
  const [resortId, setResortId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [gender, setGender] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [panel, setPanel] = useState<'view' | 'edit' | 'delete' | null>(null);
  const [menu, setMenu] = useState<{ id: string; top: number; left: number } | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);

  async function load(options?: { page?: number; search?: string }) {
    const nextPage = options?.page ?? page;
    const nextSearch = options?.search ?? search;
    try {
      const [empRes, resortRes, deptRes, deviceRes] = await Promise.all([
        api.get<ApiResponse<Employee[]>>('/employees', {
          params: {
            search: nextSearch || undefined,
            resortId: resortId || undefined,
            departmentId: departmentId || undefined,
            gender: gender || undefined,
            status: status || undefined,
            page: nextPage,
            limit: PAGE_SIZE,
          },
        }),
        api.get<ApiResponse<Resort[]>>('/resorts'),
        api.get<ApiResponse<Department[]>>('/employees/departments'),
        api.get<ApiResponse<DeviceOption[]>>('/devices').catch(() => ({ data: { data: [] as DeviceOption[] } })),
      ]);
      setEmployees(empRes.data.data);
      setTotal(empRes.data.meta?.total ?? empRes.data.data.length);
      setResorts(resortRes.data.data);
      setDepartments(deptRes.data.data);
      setDevices(deviceRes.data.data);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    void load();
  }, [resortId, departmentId, gender, status, page]);

  useEffect(() => {
    function closeMenu() {
      setMenu(null);
    }
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  function openEmployee(employee: Employee, mode: 'view' | 'edit' | 'delete') {
    setSelected(employee);
    setPanel(mode);
    setDraft({
      firstName: employee.firstName,
      lastName: employee.lastName === '-' ? '' : employee.lastName,
      departmentName: employee.departmentName ?? '',
      designation: employee.designation ?? '',
      gender: employee.gender ?? '',
      shiftStart: formatTime(employee.shiftStart) === '—' ? '09:00' : formatTime(employee.shiftStart),
      shiftEnd: formatTime(employee.shiftEnd) === '—' ? '17:00' : formatTime(employee.shiftEnd),
      currentResortId: employee.currentResortId ?? '',
    });
    setError('');
    setMessage('');
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!selected || !draft) return;
    setError('');
    try {
      await api.patch(`/employees/${selected.id}`, {
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim() || '-',
        departmentName: draft.departmentName || null,
        designation: draft.designation || null,
        gender: draft.gender || null,
        shiftStart: draft.shiftStart || null,
        shiftEnd: draft.shiftEnd || null,
        currentResortId: draft.currentResortId || null,
      });
      setMessage('Employee updated');
      setPanel(null);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function saveGender(employee: Employee, gender: string) {
    const next = gender || null;
    setEmployees((rows) => rows.map((row) => (row.id === employee.id ? { ...row, gender: next } : row)));
    setError('');
    try {
      await api.patch(`/employees/${employee.id}/gender`, { gender: next });
      setMessage(next ? `Gender saved as ${next}` : 'Gender cleared');
    } catch (err) {
      setError(getErrorMessage(err));
      await load();
    }
  }

  function openMenu(event: MouseEvent<HTMLButtonElement>, employeeId: string) {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setMenu({ id: employeeId, top: rect.bottom + 6, left: Math.max(8, rect.right - 148) });
  }

  async function removeEmployee() {
    if (!selected) return;
    setError('');
    try {
      await api.delete(`/employees/${selected.id}`);
      setMessage(`${selected.firstName} was removed from the active register. Attendance history is unchanged.`);
      setPanel(null);
      setSelected(null);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function onDeviceChange(deviceId: string) {
    const device = devices.find((item) => item.id === deviceId);
    setForm((current) => ({
      ...current,
      deviceId,
      currentResortId: device?.resortId ?? current.currentResortId,
      deviceUserId: '',
      fingerStatus: 'not_captured',
    }));
    if (!deviceId) return;
    try {
      const { data } = await api.get<ApiResponse<{ userId: string; deviceOnline: boolean }>>(
        `/devices/${deviceId}/next-user-id`
      );
      setForm((current) => ({
        ...current,
        deviceId,
        deviceUserId: data.data.userId,
        currentResortId: device?.resortId ?? current.currentResortId,
      }));
      setMessage(data.data.deviceOnline ? 'User ID fetched from the connected machine.' : 'Machine is offline. Next user ID was taken from this site’s register.');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function captureFinger() {
    if (!form.deviceId) {
      setError('Select the attendance machine first');
      return;
    }
    setError('');
    try {
      const { data } = await api.post<ApiResponse<{ captured: boolean; message: string }>>(
        `/devices/${form.deviceId}/capture-finger`
      );
      setForm((current) => ({ ...current, fingerStatus: data.data.captured ? 'captured' : 'failed' }));
      setMessage(data.data.message);
    } catch (err) {
      setForm((current) => ({ ...current, fingerStatus: 'failed' }));
      setError(getErrorMessage(err));
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError('');
    const [firstName, ...rest] = form.firstName.trim().split(/\s+/);
    const lastName = form.lastName.trim() || rest.join(' ') || firstName;
    try {
      await api.post('/employees', {
        employeeCode: `TDCP-${form.deviceUserId || Date.now().toString().slice(-6)}`,
        firstName: firstName || form.firstName,
        lastName,
        departmentName: form.departmentName || null,
        currentResortId: form.currentResortId,
        gender: form.gender,
        deviceUserId: form.deviceUserId || null,
        shiftStart: form.shiftStart,
        shiftEnd: form.shiftEnd,
        fingerStatus: form.fingerStatus,
      });
      setShowForm(false);
      setForm(emptyForm);
      setMessage('Employee saved');
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function applySearch() {
    if (page !== 1) setPage(1);
    else void load({ page: 1 });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-tdcp-navy">Employees</h1>
          <p className="text-sm text-slate-500 mt-1">
            {total} employees. Use View, Edit, or Delete on a row. User ID stays the one from the machine.
          </p>
        </div>
        {hasPermission('employees.manage') && (
          <div className="flex flex-wrap gap-2">
            <ReportUpload
              onDone={(text) => {
                setMessage(text);
                void load();
              }}
              onError={setError}
            />
            <button
              type="button"
              onClick={() => setShowForm((open) => !open)}
              className="rounded-lg bg-tdcp-green text-white text-sm font-semibold px-4 py-2"
            >
              {showForm ? 'Cancel' : 'Add from machine'}
            </button>
          </div>
        )}
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>}
      {message && <div className="rounded-lg bg-tdcp-green/10 border border-tdcp-green/30 text-tdcp-green text-sm px-4 py-3">{message}</div>}

      {showForm && (
        <form onSubmit={(e) => void onCreate(e)} className="rounded-xl bg-white border border-tdcp-border p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="text-sm">
            <span className="block text-slate-600 mb-1">Attendance machine</span>
            <select className={fieldClass + ' w-full'} value={form.deviceId} onChange={(e) => void onDeviceChange(e.target.value)} required>
              <option value="">Select machine</option>
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name} · {device.resortName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-slate-600 mb-1">User ID</span>
            <input className={fieldClass + ' w-full bg-tdcp-surface'} value={form.deviceUserId} readOnly placeholder="Fetched from machine" required />
          </label>
          <label className="text-sm">
            <span className="block text-slate-600 mb-1">Employee name</span>
            <input className={fieldClass + ' w-full'} placeholder="Full name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
          </label>
          <label className="text-sm">
            <span className="block text-slate-600 mb-1">Department</span>
            <select className={fieldClass + ' w-full'} value={form.departmentName} onChange={(e) => setForm({ ...form, departmentName: e.target.value })} required>
              <option value="">Select department</option>
              {departments.map((department) => (
                <option key={department.id} value={department.name}>{department.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-slate-600 mb-1">Shift start</span>
            <input type="time" className={fieldClass + ' w-full'} value={form.shiftStart} onChange={(e) => setForm({ ...form, shiftStart: e.target.value })} required />
          </label>
          <label className="text-sm">
            <span className="block text-slate-600 mb-1">Shift end</span>
            <input type="time" className={fieldClass + ' w-full'} value={form.shiftEnd} onChange={(e) => setForm({ ...form, shiftEnd: e.target.value })} required />
          </label>
          <label className="text-sm">
            <span className="block text-slate-600 mb-1">Gender</span>
            <select className={fieldClass + ' w-full'} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-slate-600 mb-1">Last name</span>
            <input className={fieldClass + ' w-full'} placeholder="Optional if full name is one field" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </label>
          <div className="text-sm">
            <span className="block text-slate-600 mb-1">Finger</span>
            <button type="button" onClick={() => void captureFinger()} className="rounded-lg border border-tdcp-green text-tdcp-green text-sm font-semibold px-3 py-2">
              {form.fingerStatus === 'captured' ? 'Finger captured on device' : 'Capture from device'}
            </button>
          </div>
          <button type="submit" className="md:col-span-3 rounded-lg bg-tdcp-green text-white text-sm font-semibold py-2.5">
            Save employee
          </button>
        </form>
      )}

      {selected && panel === 'view' && (
        <section className="rounded-xl border border-tdcp-border bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-tdcp-navy">{selected.firstName} {selected.lastName}</h2>
            <button type="button" onClick={() => setPanel(null)} className="text-sm font-semibold text-slate-500">Close</button>
          </div>
          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <Detail label="User ID" value={selected.deviceUserId || selected.employeeCode} />
            <Detail label="Department" value={selected.departmentName ?? '—'} />
            <Detail label="Designation" value={selected.designation ?? '—'} />
            <Detail label="Shift" value={`${formatTime(selected.shiftStart)} – ${formatTime(selected.shiftEnd)}`} />
            <Detail label="Gender" value={selected.gender ?? '—'} />
            <Detail label="Finger" value={(selected.fingerStatus ?? 'not_captured').replace('_', ' ')} />
            <Detail label="Site" value={selected.resortName ?? '—'} />
            <Detail label="Status" value={selected.status} />
          </dl>
        </section>
      )}

      {selected && panel === 'edit' && draft && (
        <form onSubmit={(event) => void saveEdit(event)} className="rounded-xl border border-tdcp-border bg-white p-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="md:col-span-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-tdcp-navy">Edit {selected.firstName}</h2>
            <button type="button" onClick={() => setPanel(null)} className="text-sm font-semibold text-slate-500">Close</button>
          </div>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">User ID</span>
            <input className={fieldClass + ' w-full bg-tdcp-surface'} value={selected.deviceUserId || selected.employeeCode} readOnly />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">First name</span>
            <input className={fieldClass + ' w-full'} value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} required />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Last name</span>
            <input className={fieldClass + ' w-full'} value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Department</span>
            <select className={fieldClass + ' w-full'} value={draft.departmentName} onChange={(e) => setDraft({ ...draft, departmentName: e.target.value })}>
              <option value="">No department</option>
              {departments.map((department) => (
                <option key={department.id} value={department.name}>{department.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Designation</span>
            <input className={fieldClass + ' w-full'} value={draft.designation} onChange={(e) => setDraft({ ...draft, designation: e.target.value })} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Gender</span>
            <select className={fieldClass + ' w-full'} value={draft.gender} onChange={(e) => setDraft({ ...draft, gender: e.target.value })}>
              <option value="">Not set</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Shift start</span>
            <input type="time" className={fieldClass + ' w-full'} value={draft.shiftStart} onChange={(e) => setDraft({ ...draft, shiftStart: e.target.value })} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Shift end</span>
            <input type="time" className={fieldClass + ' w-full'} value={draft.shiftEnd} onChange={(e) => setDraft({ ...draft, shiftEnd: e.target.value })} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">TDCP site</span>
            <select className={fieldClass + ' w-full'} value={draft.currentResortId} onChange={(e) => setDraft({ ...draft, currentResortId: e.target.value })}>
              {resorts.map((resort) => (
                <option key={resort.id} value={resort.id}>{resort.name}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="md:col-span-3 rounded-lg bg-tdcp-green py-2.5 text-sm font-semibold text-white">Save changes</button>
        </form>
      )}

      {selected && panel === 'delete' && (
        <section className="rounded-xl border border-red-200 bg-red-50 p-5">
          <h2 className="font-display text-lg font-semibold text-red-700">Remove {selected.firstName} {selected.lastName}?</h2>
          <p className="mt-1 text-sm text-red-700">They leave the active register. Today’s attendance record stays as it was finalized.</p>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => void removeEmployee()} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white">Delete</button>
            <button type="button" onClick={() => setPanel(null)} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700">Cancel</button>
          </div>
        </section>
      )}

      <Filters>
        <FilterField label="Search">
          <input className={fieldClass} placeholder="Name or code" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && applySearch()} />
        </FilterField>
        <FilterField label="TDCP site">
          <select className={fieldClass} value={resortId} onChange={(e) => { setResortId(e.target.value); setPage(1); }}>
            <option value="">All sites</option>
            {resorts.map((resort) => (
              <option key={resort.id} value={resort.id}>{resort.name}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Department">
          <select className={fieldClass} value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setPage(1); }}>
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Gender">
          <select className={fieldClass} value={gender} onChange={(e) => { setGender(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </FilterField>
        <FilterField label="Status">
          <select className={fieldClass} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </FilterField>
        <button type="button" onClick={applySearch} className="rounded-lg bg-tdcp-green text-white text-sm font-semibold px-4 py-2">
          Apply
        </button>
      </Filters>

      <div className="rounded-xl bg-white border border-tdcp-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-tdcp-surface text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">User ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Shift</th>
                <th className="px-4 py-3">Gender</th>
                <th className="px-4 py-3">Finger</th>
                <th className="px-4 py-3">Site</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id} className="border-t border-tdcp-border">
                  <td className="px-4 py-3 font-medium text-tdcp-navy">{employee.deviceUserId || employee.employeeCode}</td>
                  <td className="px-4 py-3">{employee.firstName} {employee.lastName}</td>
                  <td className="px-4 py-3">{employee.departmentName ?? '—'}</td>
                  <td className="px-4 py-3">{formatTime(employee.shiftStart)} – {formatTime(employee.shiftEnd)}</td>
                  <td className="px-4 py-3">
                    {hasPermission('employees.manage') ? (
                      <select
                        className={fieldClass + ' w-28'}
                        value={employee.gender ?? ''}
                        aria-label={`Gender for ${employee.firstName}`}
                        onChange={(event) => void saveGender(employee, event.target.value)}
                      >
                        <option value="">Not set</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    ) : (
                      <span className="capitalize">{employee.gender ?? '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 capitalize">{(employee.fingerStatus ?? 'not_captured').replace('_', ' ')}</td>
                  <td className="px-4 py-3">{employee.resortName ?? '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      aria-label={`Actions for ${employee.firstName}`}
                      onClick={(event) => openMenu(event, employee.id)}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-tdcp-surface hover:text-tdcp-navy"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {menu?.id === employee.id && (
                      <div
                        className="fixed z-50 w-36 rounded-lg border border-tdcp-border bg-white py-1 shadow-lg"
                        style={{ top: menu.top, left: menu.left }}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-tdcp-surface" onClick={() => { setMenu(null); openEmployee(employee, 'view'); }}>View</button>
                        {hasPermission('employees.manage') && (
                          <>
                            <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-tdcp-surface" onClick={() => { setMenu(null); openEmployee(employee, 'edit'); }}>Edit</button>
                            <button type="button" className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50" onClick={() => { setMenu(null); openEmployee(employee, 'delete'); }}>Delete</button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!employees.length && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">No employees match these filters</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium capitalize text-tdcp-navy">{value}</dd>
    </div>
  );
}

function formatTime(value?: string | null) {
  if (!value) return '—';
  return String(value).slice(0, 5);
}
