import { useState, useEffect } from 'react';
import { LayoutDashboard, BarChart3, Calendar, Recycle, Gift, ContactRound, Shirt, Receipt as ReceiptIcon, Moon, Menu, X, Database, WifiOff, LogOut, RefreshCw } from 'lucide-react';
import { supabase } from './lib/core';
import { api } from './api';
import { useCollection } from './hooks/useCollection';
import { ToastProvider } from './components/ui';
import { AuthGate } from './components/AuthGate';
import { UndoProvider, UndoRedoControls } from './components/UndoProvider';
import { ConfirmProvider } from './components/ConfirmProvider';
import { Dashboard } from './tabs/Dashboard';
import { ReportsTab } from './tabs/ReportsTab';
import { OutreachTab } from './tabs/OutreachTab';
import { SalvageTab } from './tabs/SalvageTab';
import { DonationTab } from './tabs/DonationTab';
import { ContactsTab } from './tabs/ContactsTab';
import { ClosetTab } from './tabs/ClosetTab';
import { ReceiptsTab } from './tabs/ReceiptsTab';

// ================== ROOT ==================
// Session gating happens here: the data-heavy MainApp only mounts once a
// session exists, so every initial collection load carries the user's JWT
// (with RLS enabled, unauthenticated queries would be rejected).
export default function OlympiaNightshiftTracker() {
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(!supabase);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  return (
    <ToastProvider>
      <ConfirmProvider>
      <UndoProvider>
      {supabase && !authChecked && (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">Checking session…</div>
      )}
      {supabase && authChecked && !session && <AuthGate />}
      {(!supabase || session) && <MainApp session={session} />}
      </UndoProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}

// ================== MAIN APP ==================
// Everything below only mounts after auth, so all useCollection loads below
// run with an authenticated client (required once RLS is enabled).
function MainApp({ session }) {
  const [tab, setTab] = useState('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [outreach, setOutreach, loadingOutreach, reloadOutreach] = useCollection(api.outreach.load);
  const [salvage, setSalvage, loadingSalvage, reloadSalvage] = useCollection(api.salvage.load);
  const [closet, setCloset, loadingCloset, reloadCloset] = useCollection(api.closet.load);
  const [receipts, setReceipts, loadingReceipts, reloadReceipts] = useCollection(api.receipts.load);
  const [donations, setDonations, loadingDonations, reloadDonations] = useCollection(api.donations.load);
  const [donors, setDonors, loadingDonors, reloadDonors] = useCollection(api.donors.load);
  const [donationItemTypes, setDonationItemTypes] = useState(['Blankets', 'Coats/Hoodies']);
  const [salvageItemTypes, setSalvageItemTypes] = useState(['Blankets', 'Coats/Hoodies', 'Pounds']);
  const [refreshing, setRefreshing] = useState(false);

  // Tap the app name (sidebar / mobile header) to pull fresh data from Supabase.
  async function refreshAll() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([
        reloadOutreach(), reloadSalvage(), reloadCloset(),
        reloadReceipts(), reloadDonations(), reloadDonors(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  // Lock page scroll and close the mobile drawer on Escape while it's open.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    if (!menuOpen) return () => { document.body.style.overflow = ''; };
    const onKey = e => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (loadingDonations || donations.length === 0) return;
    setDonationItemTypes(prev => {
      const merged = [...prev];
      donations.forEach(e => Object.keys(e.quantities || {}).forEach(t => { if (!merged.includes(t)) merged.push(t); }));
      return merged;
    });
  }, [loadingDonations, donations]);

  useEffect(() => {
    if (loadingSalvage || salvage.length === 0) return;
    setSalvageItemTypes(prev => {
      const merged = [...prev];
      salvage.forEach(e => Object.keys(e.quantities || {}).forEach(t => { if (!merged.includes(t)) merged.push(t); }));
      return merged;
    });
  }, [loadingSalvage, salvage]);

  const loading = loadingOutreach || loadingSalvage || loadingCloset || loadingReceipts || loadingDonations || loadingDonors;

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
    { id: 'outreach', label: 'Outreach Calendar', icon: Calendar },
    { id: 'salvage', label: 'Salvage Tracker', icon: Recycle },
    { id: 'donations', label: 'Donations', icon: Gift },
    { id: 'contacts', label: 'Contacts', icon: ContactRound },
    { id: 'closet', label: 'Clothing Closet', icon: Shirt },
    { id: 'receipts', label: 'Receipts & OCR', icon: ReceiptIcon },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 bg-slate-900 text-white min-h-screen sticky top-0 h-screen">
        <div className="p-6 border-b border-slate-700">
          <button onClick={refreshAll} title="Tap to refresh data" className="w-full text-left group">
            <h1 className="text-xl font-bold text-amber-400 flex items-center gap-2">
              <Moon size={20} className={`shrink-0 ${refreshing ? 'animate-spin' : 'group-hover:rotate-12'} transition-transform`} />
              Nightshift
            </h1>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <RefreshCw size={10} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing…' : 'Olympia Downtown Outreach — tap to refresh'}
            </p>
          </button>
        </div>
        <nav className="flex-1 p-4 flex flex-col gap-1 overflow-y-auto">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className={`sidebar-link w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 text-sm font-medium transition-colors ${tab === t.id ? 'active bg-slate-900/10 text-white border-l-[3px] border-amber-400' : 'text-slate-300 hover:bg-slate-900/10 hover:text-white border-l-[3px] border-transparent'}`}>
                <Icon size={16} className="w-5 shrink-0" /> {t.label}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-700">
          <UndoRedoControls />
        </div>
        <div className="p-4 text-xs text-slate-400 border-t border-slate-700 flex items-center justify-between gap-1.5">
          <span className="flex items-center gap-1.5">
            {supabase ? (<><Database size={12} /> Synced to Supabase</>) : (<><WifiOff size={12} /> Not configured</>)}
          </span>
          {session && (
            <button onClick={() => supabase.auth.signOut()} title="Sign out" className="flex items-center gap-1 hover:text-white">
              <LogOut size={12} /> Sign out
            </button>
          )}
        </div>
      </aside>

      {/* Mobile slide-out drawer — full sidebar navigation on phones */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
          <div className="drawer-panel absolute left-0 top-0 h-full w-72 bg-slate-900 text-white flex flex-col shadow-xl">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between gap-2">
              <button onClick={() => { setMenuOpen(false); refreshAll(); }} title="Tap to refresh data" className="text-left group min-w-0">
                <h1 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                  <Moon size={18} className={`shrink-0 ${refreshing ? 'animate-spin' : 'group-hover:rotate-12'} transition-transform`} />
                  Nightshift
                </h1>
              </button>
              <button onClick={() => setMenuOpen(false)} title="Close menu" className="p-1 rounded-lg hover:bg-white/10 shrink-0">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
              {tabs.map(t => {
                const Icon = t.icon;
                return (
                  <button key={t.id} onClick={() => { setTab(t.id); setMenuOpen(false); }} className={`sidebar-link w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 text-sm font-medium transition-colors ${tab === t.id ? 'active bg-white/10 text-white border-l-[3px] border-amber-400' : 'text-slate-300 hover:bg-white/10 hover:text-white border-l-[3px] border-transparent'}`}>
                    <Icon size={16} className="w-5 shrink-0" /> {t.label}
                  </button>
                );
              })}
            </nav>
            <div className="p-3 border-t border-slate-700">
              <UndoRedoControls />
            </div>
            <div className="p-4 text-xs text-slate-400 border-t border-slate-700 flex items-center justify-between gap-1.5">
              <span className="flex items-center gap-1.5">
                {supabase ? (<><Database size={12} /> Synced to Supabase</>) : (<><WifiOff size={12} /> Not configured</>)}
              </span>
              {session && (
                <button onClick={() => supabase.auth.signOut()} title="Sign out" className="flex items-center gap-1 hover:text-white">
                  <LogOut size={12} /> Sign out
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile header + nav */}
        <div className="md:hidden bg-slate-900 text-white p-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => setMenuOpen(true)} title="Open menu" className="shrink-0 p-1 -ml-1 rounded-lg hover:bg-white/10">
              <Menu size={20} className="text-amber-400" />
            </button>
            <button onClick={refreshAll} title="Tap to refresh data" className="flex items-center gap-2 min-w-0">
              <Moon size={18} className={`text-amber-400 shrink-0 ${refreshing ? 'animate-spin' : ''}`} />
              <h1 className="font-bold truncate">Nightshift</h1>
            </button>
          </div>
          <div className="flex gap-1 shrink-0">
            <UndoRedoControls compact />
          </div>
        </div>
        <nav className="md:hidden flex gap-1 p-2 bg-slate-900 border-b border-slate-700 overflow-x-auto">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${tab === t.id ? 'bg-slate-100 text-slate-900' : 'bg-slate-800 text-slate-400'}`}>
                <Icon size={13} /> {t.label.split(' ')[0]}
              </button>
            );
          })}
        </nav>

        {!supabase && <div className="bg-red-950/40 border-b border-red-200 text-red-700 text-sm p-3 text-center">Supabase not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</div>}
        {loading && <div className="h-1 bg-sky-500 animate-pulse" />}

        <main className="p-4 md:p-8 w-full">
          {tab === 'dashboard' && <Dashboard outreach={outreach} salvage={salvage} closet={closet} receipts={receipts} donations={donations} salvageItemTypes={salvageItemTypes} donationItemTypes={donationItemTypes} donors={donors} />}
          {tab === 'reports' && <ReportsTab outreach={outreach} salvage={salvage} closet={closet} receipts={receipts} donations={donations} salvageItemTypes={salvageItemTypes} donationItemTypes={donationItemTypes} donors={donors} />}
          {tab === 'outreach' && <OutreachTab entries={outreach} setEntries={setOutreach} />}
          {tab === 'salvage' && <SalvageTab entries={salvage} setEntries={setSalvage} itemTypes={salvageItemTypes} setItemTypes={setSalvageItemTypes} donors={donors} setDonors={setDonors} />}
          {tab === 'donations' && <DonationTab entries={donations} setEntries={setDonations} itemTypes={donationItemTypes} setItemTypes={setDonationItemTypes} donors={donors} setDonors={setDonors} />}
          {tab === 'contacts' && <ContactsTab donors={donors} setDonors={setDonors} />}
          {tab === 'closet' && <ClosetTab entries={closet} setEntries={setCloset} />}
          {tab === 'receipts' && <ReceiptsTab receipts={receipts} setReceipts={setReceipts} />}
        </main>
      </div>
    </div>
  );
}
