export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-tdcp-navy">System Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Configurable policies — not invented TDCP rules</p>
      </div>

      <div className="rounded-xl bg-white border border-tdcp-border p-5 space-y-4 shadow-sm">
        <SettingRow
          title="Timezone"
          description="Business date calculations use Asia/Karachi."
          value="Asia/Karachi"
        />
        <SettingRow
          title="Mobile attendance"
          description="Disabled by default. Enable only when Head Office HR authorizes."
          value="Disabled"
        />
        <SettingRow
          title="Grace periods"
          description="Default late/early grace is configurable per shift and resort."
          value="15 minutes (default)"
        />
        <SettingRow
          title="Biometric templates"
          description="Fingerprint/face templates are not stored centrally unless explicitly authorized."
          value="Not stored"
        />
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
