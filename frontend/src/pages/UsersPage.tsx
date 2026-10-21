import { useEffect, useState, type FormEvent } from 'react';
import { api, getErrorMessage } from '../services/api';
import type { ApiResponse } from '../types';
import { fieldClass } from '../components/Filters';

interface AppUser {
  id: string;
  username: string;
  email: string;
  status: string;
  roleCode: string;
  roleName: string;
}

interface RoleOption {
  id: string;
  code: string;
  name: string;
}

const emptyForm = { username: '', email: '', password: '', roleCode: 'HR' };

export default function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    const [userRes, roleRes] = await Promise.all([
      api.get<ApiResponse<AppUser[]>>('/users'),
      api.get<ApiResponse<RoleOption[]>>('/users/roles'),
    ]);
    setUsers(userRes.data.data);
    setRoles(roleRes.data.data);
  }

  useEffect(() => {
    void load().catch((err) => setError(getErrorMessage(err)));
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      await api.post('/users', form);
      setForm(emptyForm);
      setMessage('User created');
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function changeRole(user: AppUser, roleCode: string) {
    setError('');
    setMessage('');
    try {
      await api.patch(`/users/${user.id}/role`, { roleCode });
      setMessage(`${user.username} is now ${roles.find((role) => role.code === roleCode)?.name ?? roleCode}`);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-tdcp-navy">Users and roles</h1>
        <p className="mt-1 text-sm text-slate-500">Create a login for Admin, HR, or Finance.</p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-lg border border-tdcp-green/30 bg-tdcp-green/10 px-4 py-3 text-sm text-tdcp-green">{message}</div>}

      <form onSubmit={(event) => void onCreate(event)} className="grid grid-cols-1 gap-4 rounded-xl border border-tdcp-border bg-white p-5 md:grid-cols-4">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Username</span>
          <input className={fieldClass + ' w-full'} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Email</span>
          <input type="email" className={fieldClass + ' w-full'} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Password</span>
          <input type="password" className={fieldClass + ' w-full'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} required />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Role</span>
          <select className={fieldClass + ' w-full'} value={form.roleCode} onChange={(e) => setForm({ ...form, roleCode: e.target.value })}>
            {roles.map((role) => (
              <option key={role.id} value={role.code}>{role.name}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-tdcp-green py-2.5 text-sm font-semibold text-white md:col-span-4">Add user</button>
      </form>

      <div className="overflow-hidden rounded-xl border border-tdcp-border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-tdcp-surface text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-tdcp-border">
                <td className="px-4 py-3 font-medium text-tdcp-navy">{user.username}</td>
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3">
                  {user.username === 'superadmin' ? (
                    user.roleName
                  ) : (
                    <select className={fieldClass} value={user.roleCode} onChange={(e) => void changeRole(user, e.target.value)}>
                      {!roles.some((role) => role.code === user.roleCode) && (
                        <option value={user.roleCode}>{user.roleName}</option>
                      )}
                      {roles.map((role) => (
                        <option key={role.id} value={role.code}>{role.name}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-4 py-3 capitalize">{user.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
