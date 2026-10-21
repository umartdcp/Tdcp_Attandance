import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Clock, Eye, EyeOff, Loader2, Lock, Shield, User, Users } from 'lucide-react';
import { useAuth, getErrorMessage } from '../contexts/AuthContext';

const REMEMBER_KEY = 'tdcp_remember_user';

function readRememberedUsername() {
  try {
    return localStorage.getItem(REMEMBER_KEY) ?? '';
  } catch {
    return '';
  }
}

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const remembered = readRememberedUsername();
  const [username, setUsername] = useState(remembered || 'superadmin');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotNote, setForgotNote] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, username);
        else localStorage.removeItem(REMEMBER_KEY);
      } catch {
        /* storage can be blocked; sign-in still proceeds */
      }
      navigate('/');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f4faf6]">
      <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[58%] lg:block">
        <img
          src="/login-hero.jpg"
          alt=""
          className="h-full w-full object-cover object-left"
        />
        <div className="absolute inset-y-0 right-0 w-40 bg-gradient-to-r from-transparent to-[#f4faf6]" />
      </div>

      <div className="relative h-44 sm:h-56 lg:hidden">
        <img src="/login-hero.jpg" alt="" className="h-full w-full object-cover object-[center_30%]" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#f4faf6] to-transparent" />
      </div>

      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[48%] lg:block">
        <svg className="absolute bottom-24 right-6 h-40 w-72 text-[#d7ead9]" viewBox="0 0 280 140" fill="currentColor" aria-hidden>
          <path d="M20 120 L70 70 L100 92 L150 40 L190 78 L230 48 L270 90 L270 140 L20 140 Z" opacity="0.85" />
          <path d="M40 140 L90 96 L130 118 L180 72 L230 110 L270 88 L270 140 Z" opacity="0.55" />
        </svg>
        <svg className="absolute right-16 top-16 h-8 w-24 text-[#9bb89a]" viewBox="0 0 96 32" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
          <path d="M4 20c6-8 10-8 14 0M28 14c5-7 9-7 13 0M58 18c6-9 11-9 16 0" />
        </svg>
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-11rem)] w-full max-w-md flex-col items-center px-5 pb-28 pt-2 lg:absolute lg:inset-y-0 lg:right-0 lg:mx-0 lg:min-h-screen lg:w-[46%] lg:max-w-none lg:justify-center lg:px-10 lg:pb-24 lg:pt-8">
        <div className="mb-5 flex flex-col items-center text-center">
          <img
            src="/tdcp-seal.png"
            alt="Tourism Development Corporation of Punjab"
            className="h-[88px] w-[78px] object-cover object-left"
          />
          <h1 className="font-display mt-1 text-[2.6rem] font-extrabold leading-none tracking-tight text-[#0b5c28]">
            TDCP
          </h1>
          <p className="mt-2 text-sm text-slate-600">Universal Attendance Management System</p>
        </div>

        <form
          onSubmit={(e) => void onSubmit(e)}
          className="w-full max-w-[420px] rounded-2xl border border-white/80 bg-white px-7 py-7 shadow-[0_18px_50px_rgba(15,60,30,0.12)]"
        >
          <h2 className="font-display text-[1.65rem] font-bold leading-tight text-[#123524]">Welcome Back</h2>
          <p className="mt-1 text-sm text-slate-500">Sign in to your TDCP attendance system</p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <label className="mt-5 block">
            <span className="sr-only">Username</span>
            <span className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 focus-within:border-[#0b5c28] focus-within:ring-2 focus-within:ring-[#0b5c28]/20">
              <User className="h-[18px] w-[18px] shrink-0 text-slate-400" />
              <input
                className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="Username"
                required
              />
            </span>
          </label>

          <label className="mt-3 block">
            <span className="sr-only">Password</span>
            <span className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 focus-within:border-[#0b5c28] focus-within:ring-2 focus-within:ring-[#0b5c28]/20">
              <Lock className="h-[18px] w-[18px] shrink-0 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Password"
                required
              />
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
              </button>
            </span>
          </label>

          <div className="mt-3 flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-slate-600">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#0b5c28] accent-[#0b5c28]"
              />
              Remember me
            </label>
            <button
              type="button"
              className="font-medium text-[#0b5c28] hover:underline"
              onClick={() => setForgotNote((v) => !v)}
            >
              Forgot password?
            </button>
          </div>
          {forgotNote && (
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Ask a TDCP administrator to reset this password. Self-service reset is not available.
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0c6a32] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0a5829] disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign in
            <span aria-hidden>→</span>
          </button>

          <div className="my-5 flex items-center gap-3 text-[11px] font-semibold tracking-[0.18em] text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            OR
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-[11px] leading-tight text-slate-500">
            <div className="flex flex-col items-center gap-1.5">
              <Shield className="h-5 w-5 text-slate-600" strokeWidth={1.6} />
              <span>
                Secure
                <br />
                Access
              </span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <Users className="h-5 w-5 text-slate-600" strokeWidth={1.6} />
              <span>
                Authorized
                <br />
                Personnel Only
              </span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <Clock className="h-5 w-5 text-slate-600" strokeWidth={1.6} />
              <span>
                24/7
                <br />
                Availability
              </span>
            </div>
          </div>
        </form>

        <p className="mt-8 hidden text-right font-display text-lg font-semibold leading-tight text-[#1f6b3a] lg:absolute lg:bottom-16 lg:right-10 lg:mt-0 lg:block">
          Exploring Punjab
          <br />
          Enriching Lives
        </p>
      </div>

      <svg
        className="pointer-events-none absolute bottom-0 left-0 z-20 h-28 w-full text-[#0c6a32] lg:h-36"
        viewBox="0 0 1440 160"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          fill="currentColor"
          d="M0 70c180 50 280 70 460 40 160-28 250-10 400 20 170 34 280 10 420-20 80-16 130-8 160 6v44H0Z"
        />
        <path
          fill="#148a3c"
          opacity="0.85"
          d="M0 100c200 40 340 30 500 8 180-24 300 8 470 28 160 18 300-6 470-24v48H0Z"
        />
      </svg>
    </div>
  );
}
