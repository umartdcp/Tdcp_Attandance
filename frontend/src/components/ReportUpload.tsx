import { useState } from 'react';
import { api, getErrorMessage } from '../services/api';
import type { ApiResponse } from '../types';

interface ImportResult {
  updated: number;
  names: number;
  departments: number;
  checkIns: number;
  checkOuts: number;
  unmatched: number;
  unmatchedSamples: string[];
}

export default function ReportUpload({
  onDone,
  onError,
}: {
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function onFile(file: File) {
    setBusy(true);
    onError('');
    try {
      const body = new FormData();
      body.append('file', file);
      const { data } = await api.post<ApiResponse<ImportResult>>('/employees/import-report', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
        transformRequest: (payload) => payload,
      });
      onDone(summary(data.data));
    } catch (error) {
      onError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className={`rounded-lg border border-tdcp-green px-4 py-2 text-sm font-semibold text-tdcp-green ${busy ? 'opacity-60' : 'cursor-pointer'}`}>
      {busy ? 'Reading report…' : 'Upload report'}
      <input
        type="file"
        accept=".xlsx,.xls,.csv,.pdf,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void onFile(file);
        }}
      />
    </label>
  );
}

function summary(result: ImportResult): string {
  const details = [
    result.names ? `${result.names} names` : '',
    result.departments ? `${result.departments} departments` : '',
    result.checkIns ? `${result.checkIns} check-ins` : '',
    result.checkOuts ? `${result.checkOuts} check-outs` : '',
  ].filter(Boolean);
  const taken = details.length ? ` ${details.join(', ')} came from the report.` : '';
  const missed = result.unmatched
    ? ` ${result.unmatched} rows were not on the machine${result.unmatchedSamples.length ? `: ${result.unmatchedSamples.join(', ')}` : ''}.`
    : '';
  return `Updated ${result.updated} employees. User IDs stayed the ones from the machine.${taken}${missed}`;
}
