import { useRef, useState } from 'react';
import { Moon, Loader2, Delete } from 'lucide-react';
import { supabase } from '../lib/core';

// One shared volunteer account lives behind the passcode. The code IS the
// account password, so change it in Supabase (Authentication → Users) and
// everyone uses the same 6 digits. Signed-in sessions persist on the device.
const SHARED_EMAIL = 'crew@olynightshift.org';
const LENGTH = 6;

// ============================================================
// AuthGate — 6-digit passcode sign-in
// ============================================================
export function AuthGate() {
  const [digits, setDigits] = useState(Array(LENGTH).fill(''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const refs = useRef([]);

  async function submit(code) {
    setBusy(true); setError(false);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: SHARED_EMAIL, password: code });
    setBusy(false);
    if (authError) {
      setError(true);
      setDigits(Array(LENGTH).fill(''));
      refs.current[0]?.focus();
    }
    // On success, onAuthStateChange in App.jsx flips the gate open.
  }

  function handleChange(i, raw) {
    const c = raw.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = c;
    setDigits(next);
    setError(false);
    if (c && i < LENGTH - 1) refs.current[i + 1]?.focus();
    if (next.every(d => d !== '')) submit(next.join(''));
  }

  function handleKeyDown(i, e) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      const next = [...digits];
      next[i - 1] = '';
      setDigits(next);
      refs.current[i - 1]?.focus();
      e.preventDefault();
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl shadow-sm border border-slate-700 w-full max-w-xs p-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Moon size={20} className="text-amber-400" />
          <h1 className="text-xl font-bold text-slate-100">Olympia Nightshift</h1>
        </div>
        <p className="text-sm text-slate-400 mb-6">Enter the crew passcode</p>

        <div className={`flex justify-center gap-2 mb-3 ${error ? 'animate-pulse' : ''}`}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => { refs.current[i] = el; }}
              type="password"
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={1}
              value={d}
              disabled={busy}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              autoFocus={i === 0}
              className={`w-10 h-12 border-2 rounded-lg text-center text-xl font-bold focus:outline-none transition-colors
                ${error ? 'border-red-400 bg-red-950/40' : d ? 'border-sky-500' : 'border-slate-600'}
                focus:border-sky-500 disabled:opacity-50`}
            />
          ))}
        </div>

        {busy && <div className="text-sm text-slate-500 flex items-center justify-center gap-1.5 mb-2"><Loader2 size={13} className="animate-spin" /> Checking…</div>}
        {error && <div className="text-sm text-red-600 mb-2">Incorrect code — try again.</div>}

        <button
          onClick={() => { const next = Array(LENGTH).fill(''); setDigits(next); setError(false); refs.current[0]?.focus(); }}
          className="text-xs text-slate-500 hover:text-slate-400 inline-flex items-center gap-1 mb-4"
        >
          <Delete size={11} /> Clear
        </button>

        <p className="text-xs text-slate-500">This device stays signed in — no code needed next time.</p>
      </div>
    </div>
  );
}
