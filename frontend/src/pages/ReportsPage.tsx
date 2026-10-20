import AttendancePage from './AttendancePage';

/** Reports entry — consolidated attendance is the primary report in Phase 1–3. */
export default function ReportsPage() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-tdcp-navy text-white p-5">
        <h1 className="font-display text-xl font-bold">Reports</h1>
        <p className="text-sm text-white/70 mt-1">
          Head Office consolidated reporting aggregates authorized resort tables safely via the
          registry — clients never select raw table names.
        </p>
      </div>
      <AttendancePage />
    </div>
  );
}
