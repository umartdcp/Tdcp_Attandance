import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, getErrorMessage } from '../services/api';
import type { ApiResponse, Resort } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { fieldClass, FilterField, Filters } from '../components/Filters';

export default function ResortsPage() {
  const { hasPermission } = useAuth();
  const [resorts, setResorts] = useState<Resort[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [locationType, setLocationType] = useState('');
  const [locating, setLocating] = useState(false);
  const [form, setForm] = useState({
    code: '',
    name: '',
    locationType: 'resort',
    address: '',
    latitude: null as number | null,
    longitude: null as number | null,
  });

  async function load() {
    try {
      const { data } = await api.get<ApiResponse<Resort[]>>('/resorts', {
        params: { status: status || undefined },
      });
      setResorts(data.data);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    void load();
  }, [status]);

  const visible = useMemo(() => {
    return resorts.filter((resort) => {
      const haystack = `${resort.name} ${resort.code} ${resort.address ?? ''} ${resort.regionName ?? ''}`.toLowerCase();
      if (search && !haystack.includes(search.toLowerCase())) return false;
      if (locationType && resort.locationType !== locationType) return false;
      return true;
    });
  }, [resorts, search, locationType]);

  async function useMyLocation() {
    setError('');
    if (!navigator.geolocation) {
      setError('This browser cannot read your location');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { data } = await api.get<ApiResponse<{ address: string; latitude: number; longitude: number }>>(
            '/resorts/reverse-geocode',
            { params: { lat: position.coords.latitude, lng: position.coords.longitude } }
          );
          setForm((current) => ({
            ...current,
            address: data.data.address,
            latitude: data.data.latitude,
            longitude: data.data.longitude,
          }));
          setMessage('Location fetched from this office');
        } catch (err) {
          setError(getErrorMessage(err));
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setError('Location permission was denied');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/resorts', {
        ...form,
        address: form.address || null,
        latitude: form.latitude,
        longitude: form.longitude,
      });
      setShowForm(false);
      setForm({ code: '', name: '', locationType: 'resort', address: '', latitude: null, longitude: null });
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-tdcp-navy">TDCP Sites</h1>
          <p className="text-sm text-slate-500 mt-1">Each site keeps its own attendance tables</p>
        </div>
        {hasPermission('locations.manage') && (
          <button type="button" onClick={() => setShowForm((open) => !open)} className="rounded-lg bg-tdcp-green text-white text-sm font-semibold px-4 py-2">
            {showForm ? 'Cancel' : 'Add TDCP site'}
          </button>
        )}
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>}
      {message && <div className="rounded-lg bg-tdcp-green/10 border border-tdcp-green/30 text-tdcp-green text-sm px-4 py-3">{message}</div>}

      {showForm && (
        <form onSubmit={(e) => void onCreate(e)} className="rounded-xl bg-white border border-tdcp-border p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <input className={fieldClass} placeholder="Code (e.g. OFFICE_LHR)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <input className={fieldClass} placeholder="Site name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <select className={fieldClass} value={form.locationType} onChange={(e) => setForm({ ...form, locationType: e.target.value })}>
            <option value="resort">Resort</option>
            <option value="head_office">Head Office</option>
            <option value="regional_office">Regional Office</option>
            <option value="other">Other</option>
          </select>
          <div className="flex gap-2">
            <input className={fieldClass + ' flex-1'} placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <button type="button" onClick={() => void useMyLocation()} className="rounded-lg border border-tdcp-green text-tdcp-green text-sm font-semibold px-3" disabled={locating}>
              {locating ? 'Locating…' : 'Use my location'}
            </button>
          </div>
          <button type="submit" className="md:col-span-2 rounded-lg bg-tdcp-green text-white text-sm font-semibold py-2.5">
            Create site
          </button>
        </form>
      )}

      <Filters>
        <FilterField label="Search">
          <input className={fieldClass} placeholder="Name, code, address" value={search} onChange={(e) => setSearch(e.target.value)} />
        </FilterField>
        <FilterField label="Type">
          <select className={fieldClass} value={locationType} onChange={(e) => setLocationType(e.target.value)}>
            <option value="">All types</option>
            <option value="head_office">Head office</option>
            <option value="regional_office">Regional office</option>
            <option value="resort">Resort</option>
            <option value="other">Other</option>
          </select>
        </FilterField>
        <FilterField label="Status">
          <select className={fieldClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </FilterField>
      </Filters>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {visible.map((resort) => (
          <div key={resort.id} className="rounded-xl bg-white border border-tdcp-border p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-tdcp-green">{resort.code}</p>
            <h3 className="font-display font-semibold text-tdcp-navy mt-1">{resort.name}</h3>
            <p className="text-sm text-slate-500 mt-3 capitalize">
              {resort.locationType.replace('_', ' ')}
              {resort.regionName ? ` · ${resort.regionName}` : ''}
            </p>
            {resort.address && <p className="text-sm text-slate-600 mt-2">{resort.address}</p>}
            <p className="text-sm text-slate-600 mt-2">Employees: <strong>{resort.employeeCount ?? 0}</strong></p>
          </div>
        ))}
        {!visible.length && <p className="text-sm text-slate-500">No TDCP sites match these filters</p>}
      </div>
    </div>
  );
}
