import { useState } from 'react';
import { Users, Search, Plus, Download, Edit2, Trash2 } from 'lucide-react';
import { api } from '../api';
import { downloadCSV } from '../lib/core';
import { DonorFormModal } from '../components/DonorFormModal';
import { useToast } from '../components/toast-context';
import { useUndo } from '../components/undo-context';
import { useConfirm } from '../components/confirm-context';

// ============================================================
// Contacts
// ============================================================
export function ContactsTab({ donors, setDonors }) {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingDonor, setEditingDonor] = useState(null);
  const toast = useToast();
  const { runAction } = useUndo();
  const confirm = useConfirm();

  function handleSaved(row) {
    setDonors(prev => {
      const idx = prev.findIndex(d => d.id === row.id);
      if (idx >= 0) { const copy = [...prev]; copy[idx] = row; return copy.sort((a, b) => a.name.localeCompare(b.name)); }
      return [...prev, row].sort((a, b) => a.name.localeCompare(b.name));
    });
  }
  async function handleDelete(d) {
    if (!(await confirm(`Delete donor "${d.name}"?`))) return;
    const ok = await runAction({
      label: 'Delete contact',
      doFn: async () => { await api.donors.remove(d); setDonors(prev => prev.filter(x => x.id !== d.id)); },
      undoFn: async () => {
        const id = await api.donors.insert(d);
        setDonors(prev => [...prev, { ...d, id }].sort((a, b) => a.name.localeCompare(b.name)));
      },
    });
    if (ok) toast('Contact deleted.', 'success');
  }
  function exportCSV() {
    downloadCSV('donors.csv', donors.map(d => ({ Name: d.name, Organization: d.organization, Email: d.email, Phone: d.phone, Address: d.address, Notes: d.notes })));
  }
  const filtered = donors.filter(d => {
    if (!search) return true;
    const s = search.toLowerCase();
    return d.name.toLowerCase().includes(s) || d.organization.toLowerCase().includes(s) || d.email.toLowerCase().includes(s);
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Users size={20} /> Donor Contacts</h2>
          <div className="flex items-center gap-2">
            <div className="relative"><Search size={14} className="absolute left-2 top-2.5 text-gray-400" />
              <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="border rounded pl-7 pr-2 py-1 text-sm" /></div>
            <button onClick={() => { setEditingDonor(null); setShowModal(true); }} className="bg-emerald-600 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1"><Plus size={14} />Add Donor</button>
            <button onClick={exportCSV} className="bg-gray-100 px-3 py-1.5 rounded flex items-center gap-1 text-sm"><Download size={16} />Export</button>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr className="text-left border-b"><th className="p-2">Name</th><th>Organization</th><th>Email</th><th>Phone</th><th>Address</th><th></th></tr></thead>
          <tbody>
            {filtered.map(d => (
              <tr key={d.id} className="border-b hover:bg-gray-50">
                <td className="p-2 font-medium">{d.name}</td>
                <td>{d.organization || '—'}</td><td>{d.email || '—'}</td><td>{d.phone || '—'}</td>
                <td className="max-w-xs truncate">{d.address || '—'}</td>
                <td className="flex gap-2 p-2">
                  <button onClick={() => { setEditingDonor(d); setShowModal(true); }}><Edit2 size={14} className="text-blue-500" /></button>
                  <button onClick={() => handleDelete(d)}><Trash2 size={14} className="text-red-500" /></button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan="6" className="text-center text-gray-400 py-6">No donors yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {showModal && <DonorFormModal donor={editingDonor} setDonors={setDonors} onClose={() => setShowModal(false)} onSaved={handleSaved} />}
    </div>
  );
}
