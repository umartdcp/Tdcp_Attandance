import { useEffect, useState, type FormEvent } from 'react';
import { api, getErrorMessage } from '../services/api';
import type { ApiResponse, Resort } from '../types';
import { useAuth } from '../contexts/AuthContext';

export default function ResortsPage() {
  const { hasPermission } = useAuth();
  const [resorts, setResorts] = useState<Resort[]>([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    code: '',
    name: '',
    locationType: 'resort',
    address: '',
  });

  async function load() {
    try {
      const { data } = await api.get<ApiResponse<Resort[]>>('/resorts');
      setResorts(data.data);
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
      await api.post('/resorts', {
        ...form,
        address: form.address || null,
      });
      setShowForm(false);
      setForm({ code: '', name: '', locationType: 'resort', address: '' });
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-tdcp-navy">Locations</h1>
          <p className="text-sm text-slate-500 mt-1">
            Creating a location auto-provisions its attendance tables
          </p>
        </div>
        {hasPermission('locations.manage') && (
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="rounded-lg bg-tdcp-navy text-white text-sm font-semibold px-4 py-2"
          >
            {showForm ? 'Cancel' : 'Add Location'}
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
          className="rounded-xl bg-white border border-tdcp-border p-5 grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <input
            className="rounded-lg border border-tdcp-border px-3 py-2 text-sm"
            placeholder="Code (e.g. NEW_RESORT)"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            required
          />
          <input
            className="rounded-lg border border-tdcp-border px-3 py-2 text-sm"
            placeholder="Location name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <select
            className="rounded-lg border border-tdcp-border px-3 py-2 text-sm"
            value={form.locationType}
            onChange={(e) => setForm({ ...form, locationType: e.target.value })}
          >
            <option value="resort">Resort</option>
            <option value="head_office">Head Office</option>
            <option value="regional_office">Regional Office</option>
            <option value="other">Other</option>
          </select>
          <input
            className="rounded-lg border border-tdcp-border px-3 py-2 text-sm"
            placeholder="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <button
            type="submit"
            className="md:col-span-2 rounded-lg bg-tdcp-green text-white text-sm font-semibold py-2.5"
          >
            Create & provision tables
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {resorts.map((r) => (
          <div key={r.id} className="rounded-xl bg-white border border-tdcp-border p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-tdcp-green">
                  {r.code}
                </p>
                <h3 className="font-display font-semibold text-tdcp-navy mt-1">{r.name}</h3>
              </div>
              <span className="text-xs rounded-full bg-tdcp-surface px-2 py-0.5 capitalize text-slate-600">
                {r.status}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-3 capitalize">
              {r.locationType.replace('_', ' ')}
              {r.regionName ? ` · ${r.regionName}` : ''}
            </p>
            <p className="text-sm text-slate-600 mt-2">
              Employees: <strong>{r.employeeCount ?? 0}</strong>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
