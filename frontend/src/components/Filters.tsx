import type { ReactNode } from 'react';

export const fieldClass =
  'rounded-lg border border-tdcp-border px-3 py-2 text-sm bg-white min-w-[10rem]';

export function Filters({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-3 items-end rounded-xl bg-white border border-tdcp-border p-4 shadow-sm">
      {children}
    </div>
  );
}

export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="text-sm">
      <span className="block text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}
