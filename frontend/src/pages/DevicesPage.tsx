import { useEffect, useState, type FormEvent } from 'react';
import { api, getErrorMessage } from '../services/api';
import type { ApiResponse, Resort } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { fieldClass, FilterField, Filters } from '../components/Filters';

interface DeviceRow {
  id: string;
  name: string;
  serialNumber?: string;
  connectionMethod: string;
  status: string;
  lastSyncAt?: string;
  totalImportedRecords: number;
  resortId: string;
  resortName: string;
  adapterCode: string;
  manufacturer: string;
  lastError?: string;
}

interface AdapterInfo {
  code: string;
  manufacturer: string;
  verified: boolean;
  notes: string;
}

export default function DevicesPage() {
  const { hasPermission } = useAuth();
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [adapters, setAdapters] = useState<AdapterInfo[]>([]);
  const [resorts, setResorts] = useState<Resort[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [resortId, setResortId] = useState('');
  const [status, setStatus] = useState('');
  const [adapterSearch, setAdapterSearch] = useState('');
  const [form, setForm] = useState({
    resortId: '',
    adapterCode: 'zkteco_pull',
    name: '',
    host: '',
    port: '4370',
  });
  const [connect, setConnect] = useState({ host: '', port: 4000 });
  const [syncingId, setSyncingId] = useState('');

  async function load() {
    try {
      const [deviceRes, adapterRes, resortRes, connectRes] = await Promise.all([
        api.get<ApiResponse<DeviceRow[]>>('/devices', {
          params: { search: search || undefined, resortId: resortId || undefined, status: status || undefined },
        }),
        api.get<ApiResponse<AdapterInfo[]>>('/devices/adapters'),
        api.get<ApiResponse<Resort[]>>('/resorts'),
        api.get<ApiResponse<{ host: string; port: number }>>('/devices/connect-info'),
      ]);
      setDevices(deviceRes.data.data);
      setAdapters(adapterRes.data.data);
      setResorts(resortRes.data.data);
      setConnect(connectRes.data.data);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    void load();
  }, [resortId, status]);

  async function testConnection(id: string) {
    setMessage('');
    setError('');
    try {
      const { data } = await api.post<ApiResponse<{ connected: boolean; message?: string }>>(`/devices/${id}/test-connection`);
      if (data.data.connected) setMessage(data.data.message || 'Machine is reachable');
      else setError(data.data.message || 'Machine did not respond');
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function syncMachine(id: string) {
    setMessage('');
    setError('');
    setSyncingId(id);
    try {
      const { data } = await api.post<
        ApiResponse<{ employees: number; created: number; punches: number; today: string }>
      >(`/devices/${id}/sync`);
      const result = data.data;
      setMessage(
        `Loaded ${result.employees} employees and ${result.punches} punches for ${result.today}. Open Employees and Attendance to see them.`
      );
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSyncingId('');
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/devices', {
        resortId: form.resortId,
        adapterCode: form.adapterCode,
        name: form.name,
        connectionMethod: form.adapterCode === 'generic_csv' ? 'file' : 'tcp',
        connectionConfig: { host: form.host, port: Number(form.port) || 4370 },
      });
      setMessage('Machine registered');
      setForm({ resortId: '', adapterCode: 'zkteco_pull', name: '', host: '', port: '4370' });
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  const visibleAdapters = adapters.filter((adapter) =>
    `${adapter.manufacturer} ${adapter.code} ${adapter.notes}`.toLowerCase().includes(adapterSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-tdcp-navy">Attendance machines</h1>
        <p className="text-sm text-slate-500 mt-1">Point the attendance machine at this PC. It will send punches here.</p>
      </div>

      <div className="rounded-xl border border-tdcp-border bg-white p-5">
        <h2 className="font-display text-lg font-bold text-tdcp-navy">Connect the machine to this software</h2>
        <p className="mt-1 text-sm text-slate-600">
          On the attendance machine keypad open <span className="font-semibold">Menu → Comm → Cloud Server Setting</span>.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-tdcp-surface px-4 py-3">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Server address</dt>
            <dd className="mt-1 font-display text-2xl font-bold text-tdcp-green">{connect.host || '…'}</dd>
          </div>
          <div className="rounded-lg bg-tdcp-surface px-4 py-3">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Server port</dt>
            <dd className="mt-1 font-display text-2xl font-bold text-tdcp-green">{connect.port}</dd>
          </div>
        </dl>
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>Turn the cloud server on.</li>
          <li>Enter the server address and port shown above. Leave the domain name off.</li>
          <li>Save. The machine status here changes to Online when it reaches this software.</li>
        </ol>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>}
      {message && <div className="rounded-lg bg-tdcp-green/10 border border-tdcp-green/30 text-tdcp-green text-sm px-4 py-3">{message}</div>}

      {hasPermission('devices.manage') && (
        <form onSubmit={(e) => void onCreate(e)} className="rounded-xl bg-white border border-tdcp-border p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <input className={fieldClass} placeholder="Machine name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <select className={fieldClass} value={form.resortId} onChange={(e) => setForm({ ...form, resortId: e.target.value })} required>
            <option value="">TDCP site</option>
            {resorts.map((resort) => (
              <option key={resort.id} value={resort.id}>{resort.name}</option>
            ))}
          </select>
          <select className={fieldClass} value={form.adapterCode} onChange={(e) => setForm({ ...form, adapterCode: e.target.value })}>
            {adapters.map((adapter) => (
              <option key={adapter.code} value={adapter.code}>{adapter.manufacturer}</option>
            ))}
          </select>
          <input className={fieldClass} placeholder="Machine IP" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />
          <input className={fieldClass} placeholder="Port" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} />
          <button type="submit" className="rounded-lg bg-tdcp-green text-white text-sm font-semibold">Register machine</button>
        </form>
      )}

      <Filters>
        <FilterField label="Search">
          <input className={fieldClass} value={search} placeholder="Name or site" onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void load()} />
        </FilterField>
        <FilterField label="TDCP site">
          <select className={fieldClass} value={resortId} onChange={(e) => setResortId(e.target.value)}>
            <option value="">All sites</option>
            {resorts.map((resort) => (
              <option key={resort.id} value={resort.id}>{resort.name}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Status">
          <select className={fieldClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="unknown">Unknown</option>
            <option value="error">Error</option>
          </select>
        </FilterField>
        <button type="button" onClick={() => void load()} className="rounded-lg bg-tdcp-green text-white text-sm font-semibold px-4 py-2">Apply</button>
      </Filters>

      <div className="rounded-xl bg-white border border-tdcp-border overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-tdcp-surface text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Machine</th>
              <th className="px-4 py-3">Site</th>
              <th className="px-4 py-3">Adapter</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => (
              <tr key={device.id} className="border-t border-tdcp-border">
                <td className="px-4 py-3 font-medium text-tdcp-navy">{device.name}</td>
                <td className="px-4 py-3">{device.resortName}</td>
                <td className="px-4 py-3">{device.manufacturer}</td>
                <td className="px-4 py-3 capitalize">{device.status}</td>
                <td className="px-4 py-3">
                  <button type="button" onClick={() => void testConnection(device.id)} className="text-xs font-semibold text-tdcp-green">
                    Test connection
                  </button>
                  {device.adapterCode === 'zkteco_pull' && (
                    <button
                      type="button"
                      disabled={syncingId === device.id}
                      onClick={() => void syncMachine(device.id)}
                      className="ml-3 text-xs font-semibold text-tdcp-green disabled:opacity-60"
                    >
                      {syncingId === device.id ? 'Loading…' : 'Load employees and today'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!devices.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No machines match these filters</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Filters>
        <FilterField label="Adapter notes">
          <input className={fieldClass} placeholder="Filter adapters" value={adapterSearch} onChange={(e) => setAdapterSearch(e.target.value)} />
        </FilterField>
      </Filters>
      <div className="space-y-2">
        {visibleAdapters.map((adapter) => (
          <div key={adapter.code} className="rounded-lg border border-tdcp-border bg-white px-3 py-2">
            <p className="text-sm font-semibold text-tdcp-navy">{adapter.manufacturer} · {adapter.code}</p>
            <p className="text-xs text-slate-500">{adapter.notes}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
