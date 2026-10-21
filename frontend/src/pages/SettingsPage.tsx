import { useMemo, useState } from 'react';
import { fieldClass, FilterField, Filters } from '../components/Filters';

export default function SettingsPage() {
  const [search, setSearch] = useState('');
  const rows = useMemo(
    () =>
      [
        ['Timezone', 'Business dates use Asia/Karachi.', 'Asia/Karachi'],
        ['Mobile attendance', 'Stays off until Head Office turns it on.', 'Disabled'],
        ['Grace period', 'Late and early grace is set on each employee shift.', '15 minutes'],
        ['Fingerprints', 'Templates stay on the attendance machine.', 'Not stored here'],
      ].filter((row) => row.join(' ').toLowerCase().includes(search.toLowerCase())),
    [search]
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-tdcp-navy">System Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Configurable policies — not invented TDCP rules</p>
      </div>

      <Filters>
        <FilterField label="Search settings">
          <input className={fieldClass} value={search} placeholder="Timezone, finger, mobile" onChange={(e) => setSearch(e.target.value)} />
        </FilterField>
      </Filters>

      <div className="rounded-xl bg-white border border-tdcp-border p-5 space-y-4 shadow-sm">
        {rows.map(([title, description, value]) => (
          <SettingRow key={title} title={title} description={description} value={value} />
        ))}
        {!rows.length && <p className="text-sm text-slate-500">No settings match that filter</p>}
      </div>
    </div>
  );
}

function SettingRow({
  title,
  description,
  value,
}: {
  title: string;
  description: string;
  value: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-tdcp-border last:border-0 pb-4 last:pb-0">
      <div>
        <p className="font-semibold text-tdcp-navy">{title}</p>
        <p className="text-sm text-slate-500 mt-0.5">{description}</p>
      </div>
      <span className="text-sm font-medium text-tdcp-green bg-tdcp-green/10 rounded-lg px-3 py-1">
        {value}
      </span>
    </div>
  );
}
