import { useState } from 'react';
import { Moon, Mail, Lock, Loader2, Send } from 'lucide-react';
import { supabase } from '../lib/core';

// ============================================================
// AuthGate — shown when the user is not signed in
// ============================================================
export function AuthGate() {
  const [mode, setMode] = useState('magic'); // 'magic' | 'password'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null); // { type: 'info' | 'error', text }

  async function handleMagicLink(e) {
    e.preventDefault();
    if (!email.trim()) { setNotice({ type: 'error', text: 'Enter your email address.' }); return; }
    setBusy(true); setNotice(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) setNotice({ type: 'error', text: error.message });
    else setNotice({ type: 'info', text: `Sign-in link sent to ${email.trim()} — check your inbox and click the link to enter.` });
  }

  async function handlePassword(e) {
    e.preventDefault();
    if (!email.trim() || !password) { setNotice({ type: 'error', text: 'Enter your email and password.' }); return; }
    setBusy(true); setNotice(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setNotice({ type: 'error', text: error.message });
    // On success, onAuthStateChange in App.jsx flips the gate open.
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-sm p-6">
        <div className="flex items-center gap-2 mb-1">
          <Moon size={20} className="text-amber-500" />
          <h1 className="text-lg font-bold text-blue-950">Olympia Downtown Nightshift</h1>
        </div>
        <p className="text-sm text-gray-500 mb-5">Sign in to continue to the Data Tracker</p>

        <div className="flex gap-1 mb-4 bg-gray-100 rounded p-1">
          {[
            { k: 'magic', label: 'Email Link', icon: Send },
            { k: 'password', label: 'Password', icon: Lock },
          ].map(m => (
            <button key={m.k} type="button" onClick={() => { setMode(m.k); setNotice(null); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-sm font-medium ${mode === m.k ? 'bg-white shadow text-blue-900' : 'text-gray-500'}`}>
              <m.icon size={13} /> {m.label}
            </button>
          ))}
        </div>

        <form onSubmit={mode === 'magic' ? handleMagicLink : handlePassword} className="flex flex-col gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1"><Mail size={11} /> Email</label>
            <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}
              className="border rounded px-2 py-1.5 w-full text-sm" placeholder="you@example.org" autoFocus />
          </div>
          {mode === 'password' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1"><Lock size={11} /> Password</label>
              <input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)}
                className="border rounded px-2 py-1.5 w-full text-sm" placeholder="••••••••" />
            </div>
          )}
          <button type="submit" disabled={busy}
            className="bg-blue-700 text-white rounded py-2 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50">
            {busy && <Loader2 size={14} className="animate-spin" />}
            {mode === 'magic' ? 'Send Sign-In Link' : 'Sign In'}
          </button>
        </form>

        {notice && (
          <div className={`mt-4 text-sm border rounded p-2.5 ${notice.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
            {notice.text}
          </div>
        )}

        <p className="mt-5 text-xs text-gray-400 text-center">
          {mode === 'magic'
            ? 'No password needed — we email you a link.'
            : 'Ask your coordinator for an account.'}
        </p>
      </div>
    </div>
  );
}
