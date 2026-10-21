import { useState, useEffect } from 'react';
import { Home, Calendar, Package, Gift, Users, Shirt, Receipt as ReceiptIcon, Moon, Database, WifiOff, LogOut } from 'lucide-react';
import { supabase } from './lib/core';
import { api } from './api';
import { useCollection } from './hooks/useCollection';
import { ToastProvider } from './components/ui';
import { AuthGate } from './components/AuthGate';
import { UndoProvider, UndoRedoControls } from './components/UndoProvider';
import { ConfirmProvider } from './components/ConfirmProvider';
import { Dashboard } from './tabs/Dashboard';
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
        <div className="min-h-screen bg-gray-100 flex items-center justify-center text-gray-400 text-sm">Checking session…</div>
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
  const [outreach, setOutreach, loadingOutreach] = useCollection(api.outreach.load);
  const [salvage, setSalvage, loadingSalvage] = useCollection(api.salvage.load);
  const [closet, setCloset, loadingCloset] = useCollection(api.closet.load);
  const [receipts, setReceipts, loadingReceipts] = useCollection(api.receipts.load);
  const [donations, setDonations, loadingDonations] = useCollection(api.donations.load);
  const [donors, setDonors, loadingDonors] = useCollection(api.donors.load);
  const [donationItemTypes, setDonationItemTypes] = useState(['Blankets', 'Coats/Hoodies']);
  const [salvageItemTypes, setSalvageItemTypes] = useState(['Blankets', 'Coats/Hoodies', 'Pounds']);

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
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'outreach', label: 'Outreach', icon: Calendar },
    { id: 'salvage', label: 'Salvage', icon: Package },
    { id: 'donations', label: 'Donations', icon: Gift },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'closet', label: 'Closet', icon: Shirt },
    { id: 'receipts', label: 'Receipts', icon: ReceiptIcon },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 bg-blue-950 text-white min-h-screen sticky top-0 h-screen">
        <div className="p-4 border-b border-blue-900">
          <div className="flex items-center gap-2">
            <Moon size={20} className="text-amber-300" />
            <h1 className="font-bold leading-tight">Olympia Downtown<br />Nightshift</h1>
          </div>
          <p className="text-blue-300 text-xs mt-1.5">Data Tracker</p>
        </div>
        <nav className="flex-1 p-2 flex flex-col gap-1 overflow-y-auto">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-left transition-colors ${tab === t.id ? 'bg-blue-600 text-white' : 'text-blue-200 hover:bg-blue-900 hover:text-white'}`}>
                <Icon size={16} /> {t.label}
              </button>
            );
          })}
        </nav>
        <div className="p-2 flex gap-1 border-t border-blue-900">
          <UndoRedoControls />
        </div>
        <div className="p-3 text-xs text-blue-300 border-t border-blue-900 flex items-center justify-between gap-1.5">
          <span className="flex items-center gap-1.5">
            {supabase ? (<><Database size={12} /> Connected</>) : (<><WifiOff size={12} /> Not configured</>)}
          </span>
          {session && (
            <button onClick={() => supabase.auth.signOut()} title="Sign out" className="flex items-center gap-1 hover:text-white">
              <LogOut size={12} /> Sign out
            </button>
          )}
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile header + nav */}
        <div className="md:hidden bg-blue-950 text-white p-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Moon size={18} className="text-amber-300 shrink-0" />
            <h1 className="font-bold truncate">Olympia Downtown Nightshift</h1>
          </div>
          <div className="flex gap-1 shrink-0">
            <UndoRedoControls compact />
          </div>
        </div>
        <nav className="md:hidden flex gap-1 p-2 bg-white border-b overflow-x-auto">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium whitespace-nowrap ${tab === t.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                <Icon size={13} /> {t.label}
              </button>
            );
          })}
        </nav>

        {!supabase && <div className="bg-red-50 border-b border-red-200 text-red-700 text-sm p-3 text-center">Supabase not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</div>}
        {loading && <div className="h-1 bg-blue-600 animate-pulse" />}

        <main className="p-4 max-w-6xl mx-auto w-full">
          {tab === 'dashboard' && <Dashboard outreach={outreach} salvage={salvage} closet={closet} receipts={receipts} donations={donations} salvageItemTypes={salvageItemTypes} donationItemTypes={donationItemTypes} donors={donors} />}
          {tab === 'outreach' && <OutreachTab entries={outreach} setEntries={setOutreach} />}
          {tab === 'salvage' && <SalvageTab entries={salvage} setEntries={setSalvage} itemTypes={salvageItemTypes} setItemTypes={setSalvageItemTypes} donors={donors} setDonors={setDonors} />}
          {tab === 'donations' && <DonationTab entries={donations} setEntries={setDonations} itemTypes={donationItemTypes} setItemTypes={setDonationItemTypes} donors={donors} setDonors={setDonors} />}
          {tab === 'contacts' && <ContactsTab donors={donors} setDonors={setDonors} />}
          {tab === 'closet' && <ClosetTab entries={closet} setCloset={setCloset} />}
          {tab === 'receipts' && <ReceiptsTab receipts={receipts} setReceipts={setReceipts} />}
        </main>
      </div>
    </div>
  );
}
