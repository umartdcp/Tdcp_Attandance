import { useEffect, useState } from 'react';
import { api, getErrorMessage } from '../services/api';
import type { ApiResponse } from '../types';

interface DeviceRow {
  id: string;
  name: string;
  serialNumber?: string;
  connectionMethod: string;
  status: string;
  lastSyncAt?: string;
  totalImportedRecords: number;
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
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [adapters, setAdapters] = useState<AdapterInfo[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    try {
      const [d, a] = await Promise.all([
        api.get<ApiResponse<DeviceRow[]>>('/devices'),
        api.get<ApiResponse<AdapterInfo[]>>('/devices/adapters'),
      ]);
      setDevices(d.data.data);
      setAdapters(a.data.data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function testConnection(id: string) {
    setMessage('');
    setError('');
    try {
      const { data } = await api.post<ApiResponse<{ connected: boolean }>>(
        `/devices/${id}/test-connection`
      );
      setMessage(data.data.connected ? 'Connection successful' : 'Connection failed');
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-tdcp-navy">Biometric Devices</h1>
        <p className="text-sm text-slate-500 mt-1">
          Modular adapters — only verified capabilities are enabled
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg bg-tdcp-green/10 border border-tdcp-green/30 text-tdcp-green text-sm px-4 py-3">
          {message}
        </div>
      )}

      <div className="rounded-xl bg-white border border-tdcp-border p-5 shadow-sm">
        <h2 className="font-display font-semibold text-tdcp-navy mb-3">Registered Adapters</h2>
        <div className="space-y-2">
          {adapters.map((a) => (
            <div
              key={a.code}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-tdcp-border px-3 py-2"
            >
              <div>
                <p className="text-sm font-semibold text-tdcp-navy">
                  {a.manufacturer} · {a.code}
                </p>
                <p className="text-xs text-slate-500">{a.notes}</p>
              </div>
              <span
                className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${
                  a.verified
                    ? 'bg-tdcp-green/10 text-tdcp-green'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                {a.verified ? 'Verified' : 'Unverified'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-white border border-tdcp-border overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-tdcp-surface text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Device</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Adapter</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Imported</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.id} className="border-t border-tdcp-border">
                <td className="px-4 py-3">
                  <p className="font-medium text-tdcp-navy">{d.name}</p>
                  <p className="text-xs text-slate-500">{d.serialNumber ?? d.connectionMethod}</p>
                </td>
                <td className="px-4 py-3">{d.resortName}</td>
                <td className="px-4 py-3">
                  {d.manufacturer} / {d.adapterCode}
                </td>
                <td className="px-4 py-3 capitalize">{d.status}</td>
                <td className="px-4 py-3">{d.totalImportedRecords}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => void testConnection(d.id)}
                    className="text-xs font-semibold text-tdcp-green hover:underline"
                  >
                    Test connection
                  </button>
                </td>
              </tr>
            ))}
            {!devices.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No devices registered yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
