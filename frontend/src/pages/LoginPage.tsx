import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Building2, Loader2 } from 'lucide-react';
import { useAuth, getErrorMessage } from '../contexts/AuthContext';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('superadmin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 20% 20%, #1b5e3b55 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, #0b1f3a88 0%, transparent 45%), linear-gradient(145deg, #0b1f3a 0%, #143056 45%, #1b5e3b 100%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        }}
      />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 border border-white/20 mb-4">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="font-display text-3xl font-bold text-white tracking-tight">TDCP</h1>
          <p className="mt-2 text-white/75 text-sm">
            Universal Attendance Management System
          </p>
        </div>

        <form
          onSubmit={(e) => void onSubmit(e)}
          className="bg-white rounded-2xl shadow-xl border border-white/40 p-8 space-y-5"
        >
          <div>
            <h2 className="font-display text-xl font-bold text-tdcp-navy">Sign in</h2>
            <p className="text-sm text-slate-500 mt-1">Authorized personnel only</p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
              {error}
            </div>
          )}

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Username</span>
            <input
              className="mt-1.5 w-full rounded-lg border border-tdcp-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-tdcp-green/40 focus:border-tdcp-green"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <input
              type="password"
              className="mt-1.5 w-full rounded-lg border border-tdcp-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-tdcp-green/40 focus:border-tdcp-green"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-tdcp-navy hover:bg-tdcp-navy-light text-white font-semibold py-2.5 text-sm transition-colors disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
