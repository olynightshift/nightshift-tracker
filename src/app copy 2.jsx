
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Calendar, Package, Shirt, Receipt as ReceiptIcon, Download, Plus, Trash2, Search, Home, Camera, ChevronLeft, ChevronRight, Gift, X, Users, Mail, Phone, MapPin, Edit2, Save } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://hipcqkzppkmqzpjjkyyw.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcGNxa3pwcGttcXpwampreXl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2ODk4MTQsImV4cCI6MjEwMjI2NTgxNH0.euarL_ewI4vEHsbRlfXhUGrO94C2YRIfYUDc8B2vTw8";

const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const TABLES = {
  outreach: 'outreach_calendar',
  blankets: 'blanket_salvage',
  donations: 'donations',
  closet: 'clothing_closet',
  receipts: 'receipts',
  receiptItems: 'receipt_items',
  donors: 'donors',
};

const pad = n => String(n).padStart(2, '0');
const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const r = new Date(d.getFullYear(), d.getMonth(), d.getDate()); r.setDate(r.getDate() + n); return r; };
const startOfWeek = d => { const r = new Date(d.getFullYear(), d.getMonth(), d.getDate()); r.setDate(r.getDate() - r.getDay()); return r; };
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const todayISO = toISO(new Date());
const PIE_COLORS = ['#3b82f6','#f59e0b','#8b5cf6','#14b8a6','#22c55e','#ec4899','#ef4444','#6366f1','#84cc16','#06b6d4'];

function downloadCSV(filename, rows) {
  if (!rows || rows.length === 0) { alert('No data to export yet.'); return; }
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  rows.forEach(r => {
    lines.push(headers.map(h => {
      let v = r[h] == null ? '' : String(r[h]);
      if (/[",\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
      return v;
    }).join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------- aggregate helpers ----------
function groupOutreachByMonth(entries, year) {
  const data = MONTHS.map(m => ({ month: m, nightshift: 0, coffee: 0 }));
  entries.forEach(e => {
    const d = parseISO(e.date);
    if (d.getFullYear() === year) {
      if (e.nightshift) data[d.getMonth()].nightshift++;
      if (e.coffee) data[d.getMonth()].coffee++;
    }
  });
  return data;
}
function groupOutreachByYear(entries) {
  const map = {};
  entries.forEach(e => {
    const y = parseISO(e.date).getFullYear();
    if (!map[y]) map[y] = { year: y, nightshift: 0, coffee: 0 };
    if (e.nightshift) map[y].nightshift++;
    if (e.coffee) map[y].coffee++;
  });
  return Object.values(map).sort((a, b) => a.year - b.year);
}
function sumBlanketsByMonth(entries, year) {
  const data = MONTHS.map(m => ({ month: m, blankets: 0, coats: 0, pounds: 0 }));
  entries.forEach(e => {
    const d = parseISO(e.date);
    if (d.getFullYear() === year) {
      data[d.getMonth()].blankets += Number(e.blankets) || 0;
      data[d.getMonth()].coats += Number(e.coats) || 0;
      data[d.getMonth()].pounds += Number(e.pounds) || 0;
    }
  });
  return data;
}
function sumBlanketsByYear(entries) {
  const map = {};
  entries.forEach(e => {
    const y = parseISO(e.date).getFullYear();
    if (!map[y]) map[y] = { year: y, blankets: 0, coats: 0, pounds: 0 };
    map[y].blankets += Number(e.blankets) || 0;
    map[y].coats += Number(e.coats) || 0;
    map[y].pounds += Number(e.pounds) || 0;
  });
  return Object.values(map).sort((a, b) => a.year - b.year);
}
function sumByDayInMonth(entries, year, month, keys) {
  const map = {};
  entries.forEach(e => {
    const d = parseISO(e.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!map[day]) { map[day] = { day }; keys.forEach(k => map[day][k] = 0); }
      keys.forEach(k => map[day][k] += Number(e[k]) || 0);
    }
  });
  return Object.values(map).sort((a, b) => a.day - b.day);
}
function receiptTotal(r) { return r.items.reduce((s, it) => s + (Number(it.cost) || 0), 0); }
function sumReceiptsByStore(receipts) {
  const map = {};
  receipts.forEach(r => { map[r.store] = (map[r.store] || 0) + receiptTotal(r); });
  return Object.entries(map).map(([store, total]) => ({ store, total })).sort((a, b) => b.total - a.total);
}
function sumReceiptsByCategory(receipts) {
  const map = {};
  receipts.forEach(r => r.items.forEach(it => {
    const cat = it.category || 'Other';
    map[cat] = (map[cat] || 0) + (Number(it.cost) || 0);
  }));
  return Object.entries(map).map(([category, total]) => ({ category, total }));
}
function sumDonationsByDayInMonth(entries, year, month, itemTypes) {
  const map = {};
  entries.forEach(e => {
    const d = parseISO(e.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!map[day]) { map[day] = { day }; itemTypes.forEach(t => map[day][t] = 0); }
      itemTypes.forEach(t => { map[day][t] += Number(e.quantities[t]) || 0; });
    }
  });
  return Object.values(map).sort((a, b) => a.day - b.day);
}
function sumDonationsByMonth(entries, year, itemTypes) {
  const data = MONTHS.map(m => { const o = { month: m }; itemTypes.forEach(t => o[t] = 0); return o; });
  entries.forEach(e => {
    const d = parseISO(e.date);
    if (d.getFullYear() === year) {
      itemTypes.forEach(t => { data[d.getMonth()][t] += Number(e.quantities[t]) || 0; });
    }
  });
  return data;
}
function sumDonationsByYear(entries, itemTypes) {
  const map = {};
  entries.forEach(e => {
    const y = parseISO(e.date).getFullYear();
    if (!map[y]) { map[y] = { year: y }; itemTypes.forEach(t => map[y][t] = 0); }
    itemTypes.forEach(t => { map[y][t] += Number(e.quantities[t]) || 0; });
  });
  return Object.values(map).sort((a, b) => a.year - b.year);
}
function sumDonationsAllTime(entries, itemTypes) {
  const totals = {};
  itemTypes.forEach(t => { totals[t] = entries.reduce((s, e) => s + (Number(e.quantities[t]) || 0), 0); });
  return totals;
}

// ---------------- Supabase API ----------------
const api = {
  outreach: {
    async load() {
      const { data, error } = await supabase.from(TABLES.outreach).select('date, nightshift, coffee');
      if (error) throw error;
      return (data || []).map(r => ({ id: r.date, date: r.date, nightshift: !!r.nightshift, coffee: !!r.coffee }));
    },
    async upsert(row) {
      const { error } = await supabase.from(TABLES.outreach).upsert(
        { date: row.date, nightshift: !!row.nightshift, coffee: !!row.coffee },
        { onConflict: 'date' }
      );
      if (error) throw error;
    },
    async remove(row) {
      const { error } = await supabase.from(TABLES.outreach).delete().eq('date', row.date);
      if (error) throw error;
    },
  },
  blankets: {
    async load() {
      const { data, error } = await supabase.from(TABLES.blankets).select('id, date, blankets, coats, pounds');
      if (error) throw error;
      return (data || []).map(r => ({ id: r.id, date: r.date, blankets: Number(r.blankets) || 0, coats: Number(r.coats) || 0, pounds: Number(r.pounds) || 0 }));
    },
    async insert(row) {
      const { data, error } = await supabase.from(TABLES.blankets).insert({
        date: row.date, blankets: Number(row.blankets) || 0, coats: Number(row.coats) || 0, pounds: Number(row.pounds) || 0,
      }).select('id').single();
      if (error) throw error;
      return data.id;
    },
    async update(row) {
      const { error } = await supabase.from(TABLES.blankets).update({
        date: row.date, blankets: Number(row.blankets) || 0, coats: Number(row.coats) || 0, pounds: Number(row.pounds) || 0,
      }).eq('id', row.id);
      if (error) throw error;
    },
    async remove(row) {
      const { error } = await supabase.from(TABLES.blankets).delete().eq('id', row.id);
      if (error) throw error;
    },
  },
  closet: {
    async load() {
      const { data, error } = await supabase.from(TABLES.closet).select('id, date, people_served');
      if (error) throw error;
      return (data || []).map(r => ({ id: r.id, date: r.date, people: Number(r.people_served) || 0 }));
    },
    async insert(row) {
      const { data, error } = await supabase.from(TABLES.closet).insert({ date: row.date, people_served: Number(row.people) || 0 }).select('id').single();
      if (error) throw error;
      return data.id;
    },
    async update(row) {
      const { error } = await supabase.from(TABLES.closet).update({ date: row.date, people_served: Number(row.people) || 0 }).eq('id', row.id);
      if (error) throw error;
    },
    async remove(row) {
      const { error } = await supabase.from(TABLES.closet).delete().eq('id', row.id);
      if (error) throw error;
    },
  },
  donations: {
    async load() {
      const { data, error } = await supabase.from(TABLES.donations).select('date, item_type, quantity, donor_id');
      if (error) throw error;
      const map = {};
      (data || []).forEach(r => {
        if (!r.date || !r.item_type) return;
        const key = `${r.date}|${r.donor_id ?? 'null'}`;
        if (!map[key]) map[key] = { id: key, date: r.date, donor_id: r.donor_id ?? null, quantities: {} };
        map[key].quantities[r.item_type] = (map[key].quantities[r.item_type] || 0) + (Number(r.quantity) || 0);
      });
      return Object.values(map);
    },
    async upsertEntry(row) {
      let del = supabase.from(TABLES.donations).delete().eq('date', row.date);
      del = row.donor_id == null ? del.is('donor_id', null) : del.eq('donor_id', row.donor_id);
      const { error: delErr } = await del;
      if (delErr) throw delErr;
      const payload = Object.entries(row.quantities || {})
        .filter(([, q]) => Number(q) > 0)
        .map(([item_type, quantity]) => ({
          date: row.date,
          item_type,
          quantity: Number(quantity),
          donor_id: row.donor_id ?? null,
        }));
      if (payload.length === 0) return;
      const { error } = await supabase.from(TABLES.donations).insert(payload);
      if (error) throw error;
    },
    async removeEntry(row) {
      let del = supabase.from(TABLES.donations).delete().eq('date', row.date);
      del = row.donor_id == null ? del.is('donor_id', null) : del.eq('donor_id', row.donor_id);
      const { error } = await del;
      if (error) throw error;
    },
  },
  receipts: {
    async load() {
      const [receiptsRes, itemsRes] = await Promise.all([
        supabase.from(TABLES.receipts).select('id, date, store, image_url'),
        supabase.from(TABLES.receiptItems).select('id, receipt_id, item_name, category, cost'),
      ]);
      if (receiptsRes.error) throw receiptsRes.error;
      if (itemsRes.error) throw itemsRes.error;
      const itemsByReceipt = {};
      (itemsRes.data || []).forEach(it => {
        if (!itemsByReceipt[it.receipt_id]) itemsByReceipt[it.receipt_id] = [];
        itemsByReceipt[it.receipt_id].push({ id: it.id, name: it.item_name, category: it.category, cost: Number(it.cost) || 0 });
      });
      Object.values(itemsByReceipt).forEach(list => list.sort((a, b) => a.id - b.id));
      return (receiptsRes.data || []).map(r => ({ id: r.id, date: r.date, store: r.store, image: r.image_url || null, items: itemsByReceipt[r.id] || [] }));
    },
    async insert(row) {
      const { data: rec, error } = await supabase.from(TABLES.receipts).insert({ date: row.date, store: row.store, image_url: row.image || null }).select('id').single();
      if (error) throw error;
      const items = (row.items || []).map(it => ({ receipt_id: rec.id, item_name: it.name, category: it.category || 'Other', cost: Number(it.cost) || 0 }));
      if (items.length > 0) {
        const { error: itemErr } = await supabase.from(TABLES.receiptItems).insert(items);
        if (itemErr) throw itemErr;
      }
      return rec.id;
    },
    async update(row) {
      const { error } = await supabase.from(TABLES.receipts).update({ date: row.date, store: row.store, image_url: row.image || null }).eq('id', row.id);
      if (error) throw error;
      await supabase.from(TABLES.receiptItems).delete().eq('receipt_id', row.id);
      const items = (row.items || []).map(it => ({ receipt_id: row.id, item_name: it.name, category: it.category || 'Other', cost: Number(it.cost) || 0 }));
      if (items.length > 0) {
        const { error: itemErr } = await supabase.from(TABLES.receiptItems).insert(items);
        if (itemErr) throw itemErr;
      }
    },
    async remove(row) {
      await supabase.from(TABLES.receiptItems).delete().eq('receipt_id', row.id);
      const { error } = await supabase.from(TABLES.receipts).delete().eq('id', row.id);
      if (error) throw error;
    },
  },
  donors: {
    async load() {
      const { data, error } = await supabase.from(TABLES.donors).select('id, name, organization, email, phone, address, notes').order('name');
      if (error) throw error;
      return (data || []).map(r => ({
        id: r.id, name: r.name || '', organization: r.organization || '', email: r.email || '',
        phone: r.phone || '', address: r.address || '', notes: r.notes || '',
      }));
    },
    async insert(row) {
      const { data, error } = await supabase.from(TABLES.donors).insert({
        name: row.name, organization: row.organization || null, email: row.email || null,
        phone: row.phone || null, address: row.address || null, notes: row.notes || null,
      }).select('id').single();
      if (error) throw error;
      return data.id;
    },
    async update(row) {
      const { error } = await supabase.from(TABLES.donors).update({
        name: row.name, organization: row.organization || null, email: row.email || null,
        phone: row.phone || null, address: row.address || null, notes: row.notes || null,
      }).eq('id', row.id);
      if (error) throw error;
    },
    async remove(row) {
      const { error } = await supabase.from(TABLES.donors).delete().eq('id', row.id);
      if (error) throw error;
    },
  },
};

// ---------------- Generic loader hook ----------------
function useCollection(loader) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    if (!supabase) { setLoading(false); return; }
    (async () => {
      try {
        const data = await loader();
        if (active) setRows(data);
      } catch (err) {
        console.error('Load error:', err.message || err);
        alert('Load failed: ' + (err.message || err));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return [rows, setRows, loading];
}

// ============================================================
// Donor Contact Form Modal
// ============================================================
function DonorFormModal({ donor, onClose, onSaved }) {
  const [name, setName] = useState(donor?.name || '');
  const [organization, setOrganization] = useState(donor?.organization || '');
  const [email, setEmail] = useState(donor?.email || '');
  const [phone, setPhone] = useState(donor?.phone || '');
  const [address, setAddress] = useState(donor?.address || '');
  const [notes, setNotes] = useState(donor?.notes || '');
  const [saving, setSaving] = useState(false);
  const isEdit = !!donor?.id;

  async function handleSave() {
    if (!name.trim()) { alert('Donor name is required.'); return; }
    setSaving(true);
    try {
      const row = { id: donor?.id, name: name.trim(), organization, email, phone, address, notes };
      if (isEdit) {
        await api.donors.update(row);
        onSaved(row);
      } else {
        const id = await api.donors.insert(row);
        onSaved({ ...row, id });
      }
      onClose();
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-lg w-full max-h-full overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Users size={20} /> {isEdit ? 'Edit Donor' : 'Add New Donor'}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="p-4 flex flex-col gap-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Name <span className="text-red-500">*</span></label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className="border rounded px-2 py-1 w-full" autoFocus />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Organization</label>
            <input type="text" value={organization} onChange={e => setOrganization(e.target.value)} placeholder="Company / church / group (optional)" className="border rounded px-2 py-1 w-full" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1 flex items-center gap-1"><Mail size={14} /> Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="border rounded px-2 py-1 w-full" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1 flex items-center gap-1"><Phone size={14} /> Phone</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="border rounded px-2 py-1 w-full" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1 flex items-center gap-1"><MapPin size={14} /> Address</label>
            <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2} className="border rounded px-2 py-1 w-full" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="border rounded px-2 py-1 w-full" placeholder="e.g. prefers pickup, tax receipt required, etc." />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
          <button onClick={onClose} className="px-4 py-1.5 rounded border bg-white">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 rounded bg-emerald-600 text-white disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Contact'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Contacts Tab
// ============================================================
function ContactsTab({ donors, setDonors }) {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingDonor, setEditingDonor] = useState(null);

  function openAdd() { setEditingDonor(null); setShowModal(true); }
  function openEdit(d) { setEditingDonor(d); setShowModal(true); }
  function handleSaved(row) {
    setDonors(prev => {
      const idx = prev.findIndex(d => d.id === row.id);
      if (idx >= 0) { const copy = [...prev]; copy[idx] = row; return copy.sort((a, b) => a.name.localeCompare(b.name)); }
      return [...prev, row].sort((a, b) => a.name.localeCompare(b.name));
    });
  }
  async function handleDelete(d) {
    if (!window.confirm(`Delete donor "${d.name}"? Any donations linked to them will lose the donor connection.`)) return;
    try {
      await api.donors.remove(d);
      setDonors(prev => prev.filter(x => x.id !== d.id));
    } catch (err) { alert('Delete failed: ' + err.message); }
  }
  function exportCSV() {
    downloadCSV('donors.csv', donors.map(d => ({
      Name: d.name, Organization: d.organization, Email: d.email, Phone: d.phone, Address: d.address, Notes: d.notes,
    })));
  }

  const filtered = donors.filter(d => {
    if (!search) return true;
    const s = search.toLowerCase();
    return d.name.toLowerCase().includes(s) || d.organization.toLowerCase().includes(s) || d.email.toLowerCase().includes(s);
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Users size={20} /> Donor Contacts</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2 top-2.5 text-gray-400" />
              <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="border rounded pl-7 pr-2 py-1 text-sm" />
            </div>
            <button onClick={openAdd} className="bg-emerald-600 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1"><Plus size={14} />Add Donor</button>
            <button onClick={exportCSV} className="bg-gray-100 px-3 py-1.5 rounded flex items-center gap-1 text-sm"><Download size={16} />Export</button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left border-b">
              <th className="p-2">Name</th><th>Organization</th><th>Email</th><th>Phone</th><th>Address</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => (
              <tr key={d.id} className="border-b hover:bg-gray-50">
                <td className="p-2 font-medium">{d.name}</td>
                <td>{d.organization || '—'}</td>
                <td>{d.email || '—'}</td>
                <td>{d.phone || '—'}</td>
                <td className="max-w-xs truncate">{d.address || '—'}</td>
                <td className="flex gap-2 p-2">
                  <button onClick={() => openEdit(d)} title="Edit"><Edit2 size={14} className="text-blue-500" /></button>
                  <button onClick={() => handleDelete(d)} title="Delete"><Trash2 size={14} className="text-red-500" /></button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan="6" className="text-center text-gray-400 py-6">No donors yet — click "Add Donor" to get started.</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && <DonorFormModal donor={editingDonor} onClose={() => setShowModal(false)} onSaved={handleSaved} />}
    </div>
  );
}

// ============================================================
// Dashboard
// ============================================================
function Dashboard({ outreach, blankets, closet, receipts, donations, donationItemTypes, donors }) {
  const totalNightshift = outreach.filter(e => e.nightshift).length;
  const totalCoffee = outreach.filter(e => e.coffee).length;
  const totalBlankets = blankets.reduce((s, e) => s + e.blankets, 0);
  const totalCoats = blankets.reduce((s, e) => s + e.coats, 0);
  const totalPounds = blankets.reduce((s, e) => s + e.pounds, 0);
  const totalPeople = closet.reduce((s, e) => s + e.people, 0);
  const totalSpent = receipts.reduce((s, r) => s + receiptTotal(r), 0);
  const totalDonatedItems = donations.reduce((s, e) => s + Object.values(e.quantities).reduce((ss, v) => ss + (Number(v) || 0), 0), 0);

  const stats = [
    { label: 'Nightshift Days', value: totalNightshift, color: 'bg-blue-500' },
    { label: 'Coffee Days', value: totalCoffee, color: 'bg-amber-500' },
    { label: 'Blankets Salvaged', value: totalBlankets, color: 'bg-purple-500' },
    { label: 'Coats/Hoodies', value: totalCoats, color: 'bg-teal-500' },
    { label: 'Pounds Textiles', value: totalPounds.toFixed(1), color: 'bg-green-500' },
    { label: 'People Served', value: totalPeople, color: 'bg-pink-500' },
    { label: 'Items Donated', value: totalDonatedItems, color: 'bg-emerald-500' },
    { label: 'Donors', value: donors.length, color: 'bg-cyan-500' },
    { label: 'Receipts', value: receipts.length, color: 'bg-indigo-500' },
    { label: 'Total Spent', value: '$' + totalSpent.toFixed(2), color: 'bg-red-500' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-lg shadow p-3">
            <div className={`w-2 h-2 rounded-full ${s.color} mb-2`} />
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-lg shadow p-4 text-sm text-gray-600">
        Data syncs to Supabase automatically. Use Export CSV on each tab for backups.
      </div>
    </div>
  );
}

// ---------------- Outreach ----------------
function OutreachTab({ entries, setEntries }) {
  const [formDate, setFormDate] = useState(todayISO);
  const [formNightshift, setFormNightshift] = useState(false);
  const [formCoffee, setFormCoffee] = useState(false);
  const [view, setView] = useState('week');
  const [weekAnchor, setWeekAnchor] = useState(new Date());
  const [monthAnchor, setMonthAnchor] = useState(new Date());
  const [yearSelected, setYearSelected] = useState(new Date().getFullYear());
  const [editingId, setEditingId] = useState(null);
  const [editBuffer, setEditBuffer] = useState({});

  const entryMap = {};
  entries.forEach(e => { entryMap[e.date] = e; });

  function loadDay(dateISO) {
    setFormDate(dateISO);
    const e = entryMap[dateISO];
    setFormNightshift(e ? e.nightshift : false);
    setFormCoffee(e ? e.coffee : false);
  }
  async function saveEntry() {
    const row = { id: formDate, date: formDate, nightshift: formNightshift, coffee: formCoffee };
    if (!formNightshift && !formCoffee) {
      if (entryMap[formDate]) {
        try { await api.outreach.remove(row); setEntries(prev => prev.filter(e => e.date !== formDate)); }
        catch (err) { alert('Delete failed: ' + err.message); }
      }
      return;
    }
    try {
      await api.outreach.upsert(row);
      setEntries(prev => {
        const exists = prev.find(e => e.date === formDate);
        if (exists) return prev.map(e => e.date === formDate ? row : e);
        return [...prev, row];
      });
    } catch (err) {
      if (err.message && err.message.includes('no unique or exclusion constraint')) {
        alert('Save failed: the outreach_calendar table needs a UNIQUE constraint on the "date" column. Run this SQL in Supabase:\n\nALTER TABLE outreach_calendar ADD CONSTRAINT outreach_calendar_date_unique UNIQUE (date);');
      } else {
        alert('Save failed: ' + err.message);
      }
    }
  }
  async function deleteEntry(date) {
    try { await api.outreach.remove({ date }); setEntries(prev => prev.filter(e => e.date !== date)); }
    catch (err) { alert('Delete failed: ' + err.message); }
  }
  function exportCSV() {
    const rows = entries.slice().sort((a, b) => a.date.localeCompare(b.date)).map(e => ({
      Date: e.date, Nightshift: e.nightshift ? 'Yes' : 'No', Coffee: e.coffee ? 'Yes' : 'No',
    }));
    downloadCSV('outreach_calendar.csv', rows);
  }

  const weekStart = startOfWeek(weekAnchor);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const monthYear = monthAnchor.getFullYear();
  const monthIdx = monthAnchor.getMonth();
  const firstOfMonth = new Date(monthYear, monthIdx, 1);
  const gridStart = startOfWeek(firstOfMonth);
  const monthGridDays = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const yearData = groupOutreachByMonth(entries, yearSelected);
  const allYearData = groupOutreachByYear(entries);
  const totalNightshift = entries.filter(e => e.nightshift).length;
  const totalCoffee = entries.filter(e => e.coffee).length;
  const pieData = [{ name: 'Nightshift', value: totalNightshift }, { name: 'Coffee', value: totalCoffee }];

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Calendar size={20} /> Log Outreach Day</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Date</label>
            <input type="date" value={formDate} onChange={e => loadDay(e.target.value)} className="border rounded px-2 py-1" />
          </div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={formNightshift} onChange={e => setFormNightshift(e.target.checked)} /><span className="text-sm">Nightshift Outreach</span></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={formCoffee} onChange={e => setFormCoffee(e.target.checked)} /><span className="text-sm">Mission Coffee</span></label>
          <button onClick={saveEntry} className="bg-blue-600 text-white px-4 py-1.5 rounded flex items-center gap-1"><Plus size={16} />Save Day</button>
          <button onClick={exportCSV} className="ml-auto bg-gray-100 px-3 py-1.5 rounded flex items-center gap-1 text-sm"><Download size={16} />Export CSV</button>
        </div>
      </div>

      <div className="flex gap-2">
        {['week', 'month', 'year', 'all'].map(v => (
          <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded text-sm ${view === v ? 'bg-blue-600 text-white' : 'bg-white border'}`}>
            {v === 'week' ? 'Week' : v === 'month' ? 'Month' : v === 'year' ? 'Year' : 'All Time'}
          </button>
        ))}
      </div>

      {view === 'week' && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setWeekAnchor(addDays(weekStart, -7))}><ChevronLeft /></button>
            <span className="font-medium">{toISO(weekStart)} — {toISO(addDays(weekStart, 6))}</span>
            <button onClick={() => setWeekAnchor(addDays(weekStart, 7))}><ChevronRight /></button>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b"><th className="py-1">Day</th><th>Date</th><th>Nightshift</th><th>Coffee</th><th></th></tr></thead>
            <tbody>
              {weekDays.map(d => {
                const iso = toISO(d);
                const e = entryMap[iso];
                const isEditing = editingId === iso;
                return (
                  <tr key={iso} className="border-b hover:bg-gray-50">
                    <td className="py-1.5">{DAYS[d.getDay()]}</td>
                    <td>{iso}</td>
                    <td>
                      {isEditing ? (
                        <input type="checkbox" checked={editBuffer.nightshift} onChange={ev => setEditBuffer({...editBuffer, nightshift: ev.target.checked})} />
                      ) : (e?.nightshift ? '✅' : '—')}
                    </td>
                    <td>
                      {isEditing ? (
                        <input type="checkbox" checked={editBuffer.coffee} onChange={ev => setEditBuffer({...editBuffer, coffee: ev.target.checked})} />
                      ) : (e?.coffee ? '✅' : '—')}
                    </td>
                    <td className="flex gap-2">
                      {isEditing ? (
                        <>
                          <button onClick={async () => {
                            try {
                              if (!editBuffer.nightshift && !editBuffer.coffee) {
                                await api.outreach.remove({ date: iso });
                                setEntries(prev => prev.filter(x => x.date !== iso));
                              } else {
                                await api.outreach.upsert(editBuffer);
                                setEntries(prev => {
                                  const exists = prev.find(x => x.date === iso);
                                  if (exists) return prev.map(x => x.date === iso ? editBuffer : x);
                                  return [...prev, editBuffer];
                                });
                              }
                              setEditingId(null);
                            } catch (err) { alert('Update failed: ' + err.message); }
                          }}><Save size={14} className="text-green-500" /></button>
                          <button onClick={() => setEditingId(null)}><X size={14} className="text-gray-500" /></button>
                        </>
                      ) : (
                        <>
                          {e && <button onClick={() => { setEditingId(iso); setEditBuffer({...e}); }}><Edit2 size={14} className="text-blue-500" /></button>}
                          {e && <button onClick={() => deleteEntry(iso)}><Trash2 size={14} className="text-red-500" /></button>}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {view === 'month' && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setMonthAnchor(new Date(monthYear, monthIdx - 1, 1))}><ChevronLeft /></button>
            <span className="font-medium">{MONTHS[monthIdx]} {monthYear}</span>
            <button onClick={() => setMonthAnchor(new Date(monthYear, monthIdx + 1, 1))}><ChevronRight /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-xs text-center mb-1 text-gray-500">{DAYS.map(d => <div key={d}>{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {monthGridDays.map((d, i) => {
              const iso = toISO(d);
              const e = entryMap[iso];
              const inMonth = d.getMonth() === monthIdx;
              return (
                <div key={i} onClick={() => loadDay(iso)} className={`border rounded p-1 h-16 text-xs cursor-pointer ${inMonth ? 'bg-white' : 'bg-gray-50 text-gray-300'} hover:ring-2 ring-blue-300`}>
                  <div>{d.getDate()}</div>
                  <div className="flex gap-1 mt-1">
                    {e?.nightshift && <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />}
                    {e?.coffee && <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === 'year' && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setYearSelected(y => y - 1)}><ChevronLeft /></button>
            <span className="font-medium">{yearSelected}</span>
            <button onClick={() => setYearSelected(y => y + 1)}><ChevronRight /></button>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={yearData}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Legend />
              <Bar dataKey="nightshift" fill="#3b82f6" /><Bar dataKey="coffee" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {view === 'all' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80} label>
                  {pieData.map((_, i) => <Cell key={i} fill={i === 0 ? '#3b82f6' : '#f59e0b'} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={allYearData}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="year" /><YAxis allowDecimals={false} /><Tooltip /><Legend />
                <Bar dataKey="nightshift" fill="#3b82f6" /><Bar dataKey="coffee" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Blanket ----------------
function BlanketTab({ entries, setEntries }) {
  const [formDate, setFormDate] = useState(todayISO);
  const [blanketsCount, setBlanketsCount] = useState('');
  const [coatsCount, setCoatsCount] = useState('');
  const [poundsCount, setPoundsCount] = useState('');
  const [view, setView] = useState('week');
  const [weekAnchor, setWeekAnchor] = useState(new Date());
  const [monthAnchor, setMonthAnchor] = useState(new Date());
  const [yearSelected, setYearSelected] = useState(new Date().getFullYear());
  const [editingId, setEditingId] = useState(null);
  const [editBuffer, setEditBuffer] = useState({});

  async function addEntry() {
    if (!blanketsCount && !coatsCount && !poundsCount) return;
    const row = { date: formDate, blankets: Number(blanketsCount) || 0, coats: Number(coatsCount) || 0, pounds: Number(poundsCount) || 0 };
    try {
      const id = await api.blankets.insert(row);
      setEntries(prev => [...prev, { ...row, id }]);
      setBlanketsCount(''); setCoatsCount(''); setPoundsCount('');
    } catch (err) { alert('Save failed: ' + err.message); }
  }
  async function deleteEntry(row) {
    try { await api.blankets.remove(row); setEntries(prev => prev.filter(e => e.id !== row.id)); }
    catch (err) { alert('Delete failed: ' + err.message); }
  }
  function exportCSV() {
    const rows = entries.slice().sort((a, b) => a.date.localeCompare(b.date)).map(e => ({ Date: e.date, Blankets: e.blankets, 'Coats/Hoodies': e.coats, Pounds: e.pounds }));
    downloadCSV('blanket_salvage.csv', rows);
  }

  const weekStart = startOfWeek(weekAnchor);
  const weekEntries = entries.filter(e => { const d = parseISO(e.date); return d >= weekStart && d <= addDays(weekStart, 6); });
  const monthYear = monthAnchor.getFullYear();
  const monthIdx = monthAnchor.getMonth();
  const monthEntries = entries.filter(e => { const d = parseISO(e.date); return d.getFullYear() === monthYear && d.getMonth() === monthIdx; });
  const yearData = sumBlanketsByMonth(entries, yearSelected);
  const allYearData = sumBlanketsByYear(entries);

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Package size={20} /> Log Blanket Salvage</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div><label className="block text-sm text-gray-600 mb-1">Date</label><input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className="border rounded px-2 py-1" /></div>
          <div><label className="block text-sm text-gray-600 mb-1">Blankets</label><input type="number" min="0" value={blanketsCount} onChange={e => setBlanketsCount(e.target.value)} className="border rounded px-2 py-1 w-24" /></div>
          <div><label className="block text-sm text-gray-600 mb-1">Coats/Hoodies</label><input type="number" min="0" value={coatsCount} onChange={e => setCoatsCount(e.target.value)} className="border rounded px-2 py-1 w-24" /></div>
          <div><label className="block text-sm text-gray-600 mb-1">Pounds</label><input type="number" min="0" step="0.1" value={poundsCount} onChange={e => setPoundsCount(e.target.value)} className="border rounded px-2 py-1 w-28" /></div>
          <button onClick={addEntry} className="bg-purple-600 text-white px-4 py-1.5 rounded flex items-center gap-1"><Plus size={16} />Add Entry</button>
          <button onClick={exportCSV} className="ml-auto bg-gray-100 px-3 py-1.5 rounded flex items-center gap-1 text-sm"><Download size={16} />Export CSV</button>
        </div>
      </div>

      <div className="flex gap-2">
        {['week', 'month', 'year', 'all'].map(v => (
          <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded text-sm ${view === v ? 'bg-purple-600 text-white' : 'bg-white border'}`}>
            {v === 'week' ? 'Week' : v === 'month' ? 'Month' : v === 'year' ? 'Year' : 'All Time'}
          </button>
        ))}
      </div>

      {view === 'week' && (
        <div className="bg-white rounded-lg shadow p-4">
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b"><th className="py-1">Date</th><th>Blankets</th><th>Coats</th><th>Pounds</th><th></th></tr></thead>
            <tbody>
              {weekEntries.sort((a, b) => a.date.localeCompare(b.date)).map(e => {
                const isEditing = editingId === e.id;
                return (
                  <tr key={e.id} className="border-b">
                    <td className="py-1.5">
                      {isEditing ? <input type="date" value={editBuffer.date} onChange={ev => setEditBuffer({...editBuffer, date: ev.target.value})} className="border rounded px-1 py-0.5 text-sm" /> : e.date}
                    </td>
                    <td>
                      {isEditing ? <input type="number" value={editBuffer.blankets} onChange={ev => setEditBuffer({...editBuffer, blankets: ev.target.value})} className="border rounded px-1 py-0.5 w-16 text-sm" /> : e.blankets}
                    </td>
                    <td>
                      {isEditing ? <input type="number" value={editBuffer.coats} onChange={ev => setEditBuffer({...editBuffer, coats: ev.target.value})} className="border rounded px-1 py-0.5 w-16 text-sm" /> : e.coats}
                    </td>
                    <td>
                      {isEditing ? <input type="number" step="0.1" value={editBuffer.pounds} onChange={ev => setEditBuffer({...editBuffer, pounds: ev.target.value})} className="border rounded px-1 py-0.5 w-20 text-sm" /> : e.pounds}
                    </td>
                    <td className="flex gap-2">
                      {isEditing ? (
                        <>
                          <button onClick={async () => {
                            try {
                              await api.blankets.update(editBuffer);
                              setEntries(prev => prev.map(x => x.id === e.id ? { ...editBuffer, id: e.id } : x));
                              setEditingId(null);
                            } catch (err) { alert('Update failed: ' + err.message); }
                          }}><Save size={14} className="text-green-500" /></button>
                          <button onClick={() => setEditingId(null)}><X size={14} className="text-gray-500" /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditingId(e.id); setEditBuffer({...e}); }}><Edit2 size={14} className="text-blue-500" /></button>
                          <button onClick={() => deleteEntry(e)}><Trash2 size={14} className="text-red-500" /></button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {view === 'month' && (
        <div className="bg-white rounded-lg shadow p-4">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sumByDayInMonth(entries, monthYear, monthIdx, ['blankets', 'coats'])}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis allowDecimals={false} /><Tooltip /><Legend />
              <Bar dataKey="blankets" fill="#8b5cf6" /><Bar dataKey="coats" fill="#14b8a6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {view === 'year' && (
        <div className="bg-white rounded-lg shadow p-4">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={yearData}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Legend />
              <Bar dataKey="blankets" fill="#8b5cf6" /><Bar dataKey="coats" fill="#14b8a6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {view === 'all' && (
        <div className="bg-white rounded-lg shadow p-4">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={allYearData}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="year" /><YAxis allowDecimals={false} /><Tooltip /><Legend />
              <Bar dataKey="blankets" fill="#8b5cf6" /><Bar dataKey="coats" fill="#14b8a6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ---------------- Donations (with donor dropdown + Add Donor button) ----------------
function DonationTab({ entries, setEntries, itemTypes, setItemTypes, donors, setDonors }) {
  const [formDate, setFormDate] = useState(todayISO);
  const [formDonorId, setFormDonorId] = useState('');
  const [formQuantities, setFormQuantities] = useState({});
  const [newItemName, setNewItemName] = useState('');
  const [showDonorModal, setShowDonorModal] = useState(false);
  const [view, setView] = useState('week');
  const [weekAnchor, setWeekAnchor] = useState(new Date());
  const [monthAnchor, setMonthAnchor] = useState(new Date());
  const [yearSelected, setYearSelected] = useState(new Date().getFullYear());
  const [editingId, setEditingId] = useState(null);
  const [editBuffer, setEditBuffer] = useState({});

  const donorMap = {};
  donors.forEach(d => { donorMap[d.id] = d; });
  const donorLabel = id => (id && donorMap[id]) ? donorMap[id].name : 'Anonymous';

  function updateQuantity(type, value) { setFormQuantities(prev => ({ ...prev, [type]: value })); }
  function addItemType() {
    const name = newItemName.trim();
    if (!name) return;
    if (itemTypes.some(t => t.toLowerCase() === name.toLowerCase())) { alert('Already exists.'); return; }
    setItemTypes(prev => [...prev, name]);
    setNewItemName('');
  }
  function removeItemType(t) { setItemTypes(prev => prev.filter(x => x !== t)); }

  function handleDonorSaved(row) {
    setDonors(prev => {
      const idx = prev.findIndex(d => d.id === row.id);
      if (idx >= 0) { const copy = [...prev]; copy[idx] = row; return copy.sort((a, b) => a.name.localeCompare(b.name)); }
      return [...prev, row].sort((a, b) => a.name.localeCompare(b.name));
    });
    setFormDonorId(String(row.id));
  }

  async function saveEntry() {
    const quantities = {};
    itemTypes.forEach(t => { quantities[t] = Number(formQuantities[t]) || 0; });
    const total = Object.values(quantities).reduce((s, v) => s + v, 0);
    if (total === 0) { alert('Enter at least one quantity > 0.'); return; }

    const donorIdNum = formDonorId ? Number(formDonorId) : null;
    const existing = entries.find(e => e.date === formDate && (e.donor_id ?? null) === donorIdNum);
    const merged = existing ? { ...existing.quantities } : {};
    Object.entries(quantities).forEach(([k, v]) => { if (v > 0) merged[k] = (merged[k] || 0) + v; });

    const key = `${formDate}|${donorIdNum ?? 'null'}`;
    const row = { id: key, date: formDate, donor_id: donorIdNum, quantities: merged };

    try {
      await api.donations.upsertEntry(row);
      setEntries(prev => {
        const idx = prev.findIndex(e => e.date === formDate && (e.donor_id ?? null) === donorIdNum);
        if (idx >= 0) { const copy = [...prev]; copy[idx] = row; return copy; }
        return [...prev, row];
      });
      setFormQuantities({});
    } catch (err) { alert('Save failed: ' + err.message); }
  }
  async function deleteEntry(row) {
    try { await api.donations.removeEntry(row); setEntries(prev => prev.filter(e => e.id !== row.id)); }
    catch (err) { alert('Delete failed: ' + err.message); }
  }
  function exportCSV() {
    const rows = entries.slice().sort((a, b) => a.date.localeCompare(b.date)).map(e => {
      const row = { Date: e.date, Donor: donorLabel(e.donor_id) };
      itemTypes.forEach(t => { row[t] = e.quantities[t] || 0; });
      return row;
    });
    downloadCSV('donation_tracker.csv', rows);
  }

  const weekStart = startOfWeek(weekAnchor);
  const weekEntries = entries.filter(e => { const d = parseISO(e.date); return d >= weekStart && d <= addDays(weekStart, 6); });
  const monthYear = monthAnchor.getFullYear();
  const monthIdx = monthAnchor.getMonth();
  const monthEntries = entries.filter(e => { const d = parseISO(e.date); return d.getFullYear() === monthYear && d.getMonth() === monthIdx; });
  const yearData = sumDonationsByMonth(entries, yearSelected, itemTypes);
  const allYearData = sumDonationsByYear(entries, itemTypes);
  const allTimeTotals = sumDonationsAllTime(entries, itemTypes);
  const pieData = itemTypes.map(t => ({ name: t, value: allTimeTotals[t] || 0 })).filter(d => d.value > 0);

  // Top donors by total items
  const donorTotals = {};
  entries.forEach(e => {
    const key = e.donor_id ?? 'null';
    const total = Object.values(e.quantities || {}).reduce((s, v) => s + (Number(v) || 0), 0);
    donorTotals[key] = (donorTotals[key] || 0) + total;
  });
  const topDonors = Object.entries(donorTotals)
    .map(([k, v]) => ({ donor: k === 'null' ? 'Anonymous' : (donorMap[Number(k)]?.name || 'Unknown'), total: v }))
    .sort((a, b) => b.total - a.total).slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Gift size={20} /> Log Donations</h2>

        <div className="mb-3">
          <div className="text-sm text-gray-600 mb-1">Item types:</div>
          <div className="flex flex-wrap gap-2">
            {itemTypes.map(t => (
              <span key={t} className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-2 py-1 rounded-full">
                {t}<button onClick={() => removeItemType(t)}><X size={12} /></button>
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 mb-4">
          <input type="text" placeholder="Add item type" value={newItemName} onChange={e => setNewItemName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItemType(); } }} className="border rounded px-2 py-1 text-sm flex-1 max-w-xs" />
          <button onClick={addItemType} className="bg-emerald-600 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1"><Plus size={14} />Add Type</button>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Date</label>
            <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className="border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1 flex items-center gap-1"><Users size={14} /> Donor</label>
            <div className="flex items-center gap-1">
              <select value={formDonorId} onChange={e => setFormDonorId(e.target.value)} className="border rounded px-2 py-1 min-w-40">
                <option value="">— Anonymous —</option>
                {donors.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}{d.organization ? ` (${d.organization})` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowDonorModal(true)}
                title="Add new donor"
                className="bg-cyan-600 text-white px-2 py-1.5 rounded flex items-center gap-1 text-sm"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
          {itemTypes.map(t => (
            <div key={t}><label className="block text-sm text-gray-600 mb-1">{t}</label>
              <input type="number" min="0" value={formQuantities[t] ?? ''} onChange={e => updateQuantity(t, e.target.value)} className="border rounded px-2 py-1 w-24" /></div>
          ))}
          <button onClick={saveEntry} className="bg-emerald-600 text-white px-4 py-1.5 rounded flex items-center gap-1"><Plus size={16} />Add Entry</button>
          <button onClick={exportCSV} className="ml-auto bg-gray-100 px-3 py-1.5 rounded flex items-center gap-1 text-sm"><Download size={16} />Export CSV</button>
        </div>
      </div>

      <div className="flex gap-2">
        {['week', 'month', 'year', 'all'].map(v => (
          <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded text-sm ${view === v ? 'bg-emerald-600 text-white' : 'bg-white border'}`}>
            {v === 'week' ? 'Week' : v === 'month' ? 'Month' : v === 'year' ? 'Year' : 'All Time'}
          </button>
        ))}
      </div>

      {view === 'week' && (
        <div className="bg-white rounded-lg shadow p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b"><th className="py-1">Date</th><th>Donor</th>{itemTypes.map(t => <th key={t}>{t}</th>)}<th></th></tr></thead>
            <tbody>
              {weekEntries.sort((a, b) => a.date.localeCompare(b.date)).map(e => {
                const isEditing = editingId === e.id;
                return (
                  <tr key={e.id} className="border-b">
                    <td className="py-1.5">
                      {isEditing ? <input type="date" value={editBuffer.date} onChange={ev => setEditBuffer({...editBuffer, date: ev.target.value})} className="border rounded px-1 py-0.5 text-sm" /> : e.date}
                    </td>
                    <td>
                      {isEditing ? (
                        <select value={editBuffer.donor_id || ''} onChange={ev => setEditBuffer({...editBuffer, donor_id: ev.target.value ? Number(ev.target.value) : null})} className="border rounded px-1 py-0.5 text-sm">
                          <option value="">Anonymous</option>
                          {donors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      ) : donorLabel(e.donor_id)}
                    </td>
                    {itemTypes.map(t => (
                      <td key={t}>
                        {isEditing ? (
                          <input type="number" value={editBuffer.quantities[t] || 0} onChange={ev => setEditBuffer({...editBuffer, quantities: {...(editBuffer.quantities||{}), [t]: ev.target.value}})} className="border rounded px-1 py-0.5 w-16 text-sm" />
                        ) : (e.quantities[t] || 0)}
                      </td>
                    ))}
                    <td className="flex gap-2">
                      {isEditing ? (
                        <>
                          <button onClick={async () => {
                            try {
                              const cleanQuantities = {};
                              itemTypes.forEach(t => { cleanQuantities[t] = Number(editBuffer.quantities[t]) || 0; });
                              const rowToUpdate = { ...editBuffer, quantities: cleanQuantities };
                              await api.donations.upsertEntry(rowToUpdate);
                              setEntries(prev => prev.map(x => x.id === e.id ? { ...rowToUpdate, id: e.id } : x));
                              setEditingId(null);
                            } catch (err) { alert('Update failed: ' + err.message); }
                          }}><Save size={14} className="text-green-500" /></button>
                          <button onClick={() => setEditingId(null)}><X size={14} className="text-gray-500" /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditingId(e.id); setEditBuffer({...e, quantities: {...e.quantities}}); }}><Edit2 size={14} className="text-blue-500" /></button>
                          <button onClick={() => deleteEntry(e)}><Trash2 size={14} className="text-red-500" /></button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {weekEntries.length === 0 && <tr><td colSpan={itemTypes.length + 3} className="text-center text-gray-400 py-3">No entries this week</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {view === 'month' && (
        <div className="bg-white rounded-lg shadow p-4">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sumDonationsByDayInMonth(entries, monthYear, monthIdx, itemTypes)}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis allowDecimals={false} /><Tooltip /><Legend />
              {itemTypes.map((t, i) => <Bar key={t} dataKey={t} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </BarChart>
          </ResponsiveContainer>
          <table className="w-full text-sm mt-4">
            <thead><tr className="text-left border-b"><th className="py-1">Date</th><th>Donor</th>{itemTypes.map(t => <th key={t}>{t}</th>)}<th></th></tr></thead>
            <tbody>
              {monthEntries.sort((a, b) => a.date.localeCompare(b.date)).map(e => {
                const isEditing = editingId === e.id;
                return (
                  <tr key={e.id} className="border-b">
                    <td className="py-1.5">
                      {isEditing ? <input type="date" value={editBuffer.date} onChange={ev => setEditBuffer({...editBuffer, date: ev.target.value})} className="border rounded px-1 py-0.5 text-sm" /> : e.date}
                    </td>
                    <td>
                      {isEditing ? (
                        <select value={editBuffer.donor_id || ''} onChange={ev => setEditBuffer({...editBuffer, donor_id: ev.target.value ? Number(ev.target.value) : null})} className="border rounded px-1 py-0.5 text-sm">
                          <option value="">Anonymous</option>
                          {donors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      ) : donorLabel(e.donor_id)}
                    </td>
                    {itemTypes.map(t => (
                      <td key={t}>
                        {isEditing ? (
                          <input type="number" value={editBuffer.quantities[t] || 0} onChange={ev => setEditBuffer({...editBuffer, quantities: {...(editBuffer.quantities||{}), [t]: ev.target.value}})} className="border rounded px-1 py-0.5 w-16 text-sm" />
                        ) : (e.quantities[t] || 0)}
                      </td>
                    ))}
                    <td className="flex gap-2">
                      {isEditing ? (
                        <>
                          <button onClick={async () => {
                            try {
                              const cleanQuantities = {};
                              itemTypes.forEach(t => { cleanQuantities[t] = Number(editBuffer.quantities[t]) || 0; });
                              const rowToUpdate = { ...editBuffer, quantities: cleanQuantities };
                              await api.donations.upsertEntry(rowToUpdate);
                              setEntries(prev => prev.map(x => x.id === e.id ? { ...rowToUpdate, id: e.id } : x));
                              setEditingId(null);
                            } catch (err) { alert('Update failed: ' + err.message); }
                          }}><Save size={14} className="text-green-500" /></button>
                          <button onClick={() => setEditingId(null)}><X size={14} className="text-gray-500" /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditingId(e.id); setEditBuffer({...e, quantities: {...e.quantities}}); }}><Edit2 size={14} className="text-blue-500" /></button>
                          <button onClick={() => deleteEntry(e)}><Trash2 size={14} className="text-red-500" /></button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {view === 'year' && (
        <div className="bg-white rounded-lg shadow p-4">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={yearData}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Legend />
              {itemTypes.map((t, i) => <Bar key={t} dataKey={t} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {view === 'all' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-medium mb-2">Split by Item Type</h3>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="text-gray-400 py-8 text-center text-sm">No donations yet</div>}
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-medium mb-2">By Year</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={allYearData}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="year" /><YAxis allowDecimals={false} /><Tooltip /><Legend />
                {itemTypes.map((t, i) => <Bar key={t} dataKey={t} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-lg shadow p-4 md:col-span-2">
            <h3 className="font-medium mb-2">Top Donors (by total items)</h3>
            {topDonors.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topDonors} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="donor" width={120} /><Tooltip />
                  <Bar dataKey="total" fill="#06b6d4" />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="text-gray-400 py-4 text-center text-sm">No donor data yet</div>}
          </div>
        </div>
      )}

      {showDonorModal && <DonorFormModal onClose={() => setShowDonorModal(false)} onSaved={handleDonorSaved} />}
    </div>
  );
}

// ---------------- Closet ----------------
function ClosetTab({ entries, setEntries }) {
  const [formDate, setFormDate] = useState(todayISO);
  const [peopleCount, setPeopleCount] = useState('');
  const [view, setView] = useState('week');
  const [weekAnchor, setWeekAnchor] = useState(new Date());
  const [monthAnchor, setMonthAnchor] = useState(new Date());
  const [yearSelected, setYearSelected] = useState(new Date().getFullYear());
  const [editingId, setEditingId] = useState(null);
  const [editBuffer, setEditBuffer] = useState({});

  async function addEntry() {
    if (!peopleCount) return;
    const row = { date: formDate, people: Number(peopleCount) || 0 };
    try { const id = await api.closet.insert(row); setEntries(prev => [...prev, { ...row, id }]); setPeopleCount(''); }
    catch (err) { alert('Save failed: ' + err.message); }
  }
  async function deleteEntry(row) {
    try { await api.closet.remove(row); setEntries(prev => prev.filter(e => e.id !== row.id)); }
    catch (err) { alert('Delete failed: ' + err.message); }
  }
  function exportCSV() {
    downloadCSV('clothing_closet.csv', entries.slice().sort((a, b) => a.date.localeCompare(b.date)).map(e => ({ Date: e.date, 'People Served': e.people })));
  }

  const weekStart = startOfWeek(weekAnchor);
  const weekEntries = entries.filter(e => { const d = parseISO(e.date); return d >= weekStart && d <= addDays(weekStart, 6); });
  const monthYear = monthAnchor.getFullYear();
  const monthIdx = monthAnchor.getMonth();
  const yearData = MONTHS.map((m, i) => ({ month: m, people: entries.filter(e => { const d = parseISO(e.date); return d.getFullYear() === yearSelected && d.getMonth() === i; }).reduce((s, e) => s + e.people, 0) }));
  const yearMap = {};
  entries.forEach(e => { const y = parseISO(e.date).getFullYear(); yearMap[y] = (yearMap[y] || 0) + e.people; });
  const allYearData = Object.entries(yearMap).map(([year, people]) => ({ year, people })).sort((a, b) => a.year - b.year);

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Shirt size={20} /> Log Closet Day</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div><label className="block text-sm text-gray-600 mb-1">Date</label><input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className="border rounded px-2 py-1" /></div>
          <div><label className="block text-sm text-gray-600 mb-1">People Served</label><input type="number" min="0" value={peopleCount} onChange={e => setPeopleCount(e.target.value)} className="border rounded px-2 py-1 w-28" /></div>
          <button onClick={addEntry} className="bg-pink-600 text-white px-4 py-1.5 rounded flex items-center gap-1"><Plus size={16} />Add</button>
          <button onClick={exportCSV} className="ml-auto bg-gray-100 px-3 py-1.5 rounded flex items-center gap-1 text-sm"><Download size={16} />Export CSV</button>
        </div>
      </div>

      <div className="flex gap-2">
        {['week', 'month', 'year', 'all'].map(v => (
          <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded text-sm ${view === v ? 'bg-pink-600 text-white' : 'bg-white border'}`}>
            {v === 'week' ? 'Week' : v === 'month' ? 'Month' : v === 'year' ? 'Year' : 'All Time'}
          </button>
        ))}
      </div>

      {view === 'week' && (
        <div className="bg-white rounded-lg shadow p-4">
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b"><th className="py-1">Date</th><th>People</th><th></th></tr></thead>
            <tbody>
              {weekEntries.sort((a, b) => a.date.localeCompare(b.date)).map(e => {
                const isEditing = editingId === e.id;
                return (
                  <tr key={e.id} className="border-b">
                    <td className="py-1.5">
                      {isEditing ? <input type="date" value={editBuffer.date} onChange={ev => setEditBuffer({...editBuffer, date: ev.target.value})} className="border rounded px-1 py-0.5 text-sm" /> : e.date}
                    </td>
                    <td>
                      {isEditing ? <input type="number" value={editBuffer.people} onChange={ev => setEditBuffer({...editBuffer, people: ev.target.value})} className="border rounded px-1 py-0.5 w-20 text-sm" /> : e.people}
                    </td>
                    <td className="flex gap-2">
                      {isEditing ? (
                        <>
                          <button onClick={async () => {
                            try {
                              await api.closet.update(editBuffer);
                              setEntries(prev => prev.map(x => x.id === e.id ? { ...editBuffer, id: e.id } : x));
                              setEditingId(null);
                            } catch (err) { alert('Update failed: ' + err.message); }
                          }}><Save size={14} className="text-green-500" /></button>
                          <button onClick={() => setEditingId(null)}><X size={14} className="text-gray-500" /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditingId(e.id); setEditBuffer({...e}); }}><Edit2 size={14} className="text-blue-500" /></button>
                          <button onClick={() => deleteEntry(e)}><Trash2 size={14} className="text-red-500" /></button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {view === 'month' && (
        <div className="bg-white rounded-lg shadow p-4">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sumByDayInMonth(entries, monthYear, monthIdx, ['people'])}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis allowDecimals={false} /><Tooltip />
              <Bar dataKey="people" fill="#ec4899" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {view === 'year' && (
        <div className="bg-white rounded-lg shadow p-4">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={yearData}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip />
              <Bar dataKey="people" fill="#ec4899" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {view === 'all' && (
        <div className="bg-white rounded-lg shadow p-4">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={allYearData}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="year" /><YAxis allowDecimals={false} /><Tooltip />
              <Bar dataKey="people" fill="#ec4899" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ---------------- Receipts ----------------
function ReceiptsTab({ receipts, setReceipts }) {
  const CATEGORIES = ['Cleaning Supplies', 'Laundry', 'Food & Coffee', 'Fuel/Transportation', 'Vehicle Maintenance', 'Office Supplies', 'Blankets/Clothing Purchase', 'Utilities', 'Other'];
  const [date, setDate] = useState(todayISO);
  const [store, setStore] = useState('');
  const [items, setItems] = useState([{ name: '', cost: '', category: CATEGORIES[0] }]);
  const [image, setImage] = useState(null);
  const [searchStore, setSearchStore] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [view, setView] = useState('list');
  const [editingId, setEditingId] = useState(null);
  const [editBuffer, setEditBuffer] = useState({});

  function updateItem(i, field, value) { setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it)); }
  function addItemRow() { setItems(prev => [...prev, { name: '', cost: '', category: CATEGORIES[0] }]); }
  function removeItemRow(i) { setItems(prev => prev.filter((_, idx) => idx !== i)); }
  function handleImage(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = () => setImage(reader.result); reader.readAsDataURL(file);
  }
  async function saveReceipt() {
    if (!store || items.every(it => !it.name && !it.cost)) { alert('Enter a store and at least one item.'); return; }
    const row = { date, store, image, items: items.filter(it => it.name || it.cost).map(it => ({ ...it, cost: Number(it.cost) || 0 })) };
    try {
      const id = await api.receipts.insert(row);
      setReceipts(prev => [...prev, { ...row, id }]);
      setDate(todayISO); setStore(''); setItems([{ name: '', cost: '', category: CATEGORIES[0] }]); setImage(null);
    } catch (err) { alert('Save failed: ' + err.message); }
  }
  async function deleteReceipt(row) {
    try { await api.receipts.remove(row); setReceipts(prev => prev.filter(r => r.id !== row.id)); }
    catch (err) { alert('Delete failed: ' + err.message); }
  }
  function exportCSV() {
    const rows = [];
    receipts.forEach(r => r.items.forEach(it => rows.push({ Date: r.date, Store: r.store, Item: it.name, Category: it.category, Cost: it.cost })));
    downloadCSV('receipts.csv', rows.sort((a, b) => a.Date.localeCompare(b.Date)));
  }

  const filtered = receipts.filter(r => {
    if (searchStore && !r.store.toLowerCase().includes(searchStore.toLowerCase())) return false;
    if (filterCategory !== 'All' && !r.items.some(it => it.category === filterCategory)) return false;
    if (dateFrom && r.date < dateFrom) return false;
    if (dateTo && r.date > dateTo) return false;
    return true;
  });
  const storeData = sumReceiptsByStore(filtered);
  const categoryData = sumReceiptsByCategory(filtered);
  const totalSpent = filtered.reduce((s, r) => s + receiptTotal(r), 0);
  const monthMap = {};
  filtered.forEach(r => { const key = r.date.slice(0, 7); monthMap[key] = (monthMap[key] || 0) + receiptTotal(r); });
  const monthTrend = Object.entries(monthMap).sort((a, b) => a[0].localeCompare(b[0])).map(([month, total]) => ({ month, total }));

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><ReceiptIcon size={20} /> Log a Receipt</h2>
        <div className="flex flex-wrap items-end gap-4 mb-3">
          <div><label className="block text-sm text-gray-600 mb-1">Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="border rounded px-2 py-1" /></div>
          <div><label className="block text-sm text-gray-600 mb-1">Store</label><input type="text" value={store} onChange={e => setStore(e.target.value)} placeholder="e.g. Costco" className="border rounded px-2 py-1" /></div>
          <div><label className="block text-sm text-gray-600 mb-1 flex items-center gap-1"><Camera size={14} /> Photo</label><input type="file" accept="image/*" onChange={handleImage} className="text-sm" /></div>
          {image && <img src={image} alt="receipt" className="h-16 rounded border" />}
        </div>
        <div className="flex flex-col gap-2 mb-3">
          {items.map((it, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input type="text" placeholder="Item" value={it.name} onChange={e => updateItem(i, 'name', e.target.value)} className="border rounded px-2 py-1 flex-1" />
              <input type="number" step="0.01" placeholder="Cost" value={it.cost} onChange={e => updateItem(i, 'cost', e.target.value)} className="border rounded px-2 py-1 w-24" />
              <select value={it.category} onChange={e => updateItem(i, 'category', e.target.value)} className="border rounded px-2 py-1">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button onClick={() => removeItemRow(i)}><Trash2 size={16} className="text-red-500" /></button>
            </div>
          ))}
          <button onClick={addItemRow} className="text-sm text-blue-600 flex items-center gap-1 w-fit"><Plus size={14} />Add Item</button>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Total: ${items.reduce((s, it) => s + (Number(it.cost) || 0), 0).toFixed(2)}</div>
          <button onClick={saveReceipt} className="bg-indigo-600 text-white px-4 py-1.5 rounded flex items-center gap-1"><Plus size={16} />Save Receipt</button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div><label className="block text-sm text-gray-600 mb-1 flex items-center gap-1"><Search size={14} />Search</label><input type="text" value={searchStore} onChange={e => setSearchStore(e.target.value)} className="border rounded px-2 py-1" /></div>
          <div><label className="block text-sm text-gray-600 mb-1">Category</label>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="border rounded px-2 py-1">
              <option>All</option>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select></div>
          <div><label className="block text-sm text-gray-600 mb-1">From</label><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border rounded px-2 py-1" /></div>
          <div><label className="block text-sm text-gray-600 mb-1">To</label><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border rounded px-2 py-1" /></div>
          <button onClick={exportCSV} className="ml-auto bg-gray-100 px-3 py-1.5 rounded flex items-center gap-1 text-sm"><Download size={16} />Export CSV</button>
        </div>
      </div>

      <div className="flex gap-2">
        {['list', 'reports'].map(v => (
          <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded text-sm ${view === v ? 'bg-indigo-600 text-white' : 'bg-white border'}`}>{v === 'list' ? 'List' : 'Reports'}</button>
        ))}
      </div>

      {view === 'list' && (
        <div className="flex flex-col gap-3">
          {filtered.slice().sort((a, b) => b.date.localeCompare(a.date)).map(r => {
            const isEditing = editingId === r.id;
            return (
              <div key={r.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    {isEditing ? (
                      <div className="flex flex-wrap gap-2 mb-2">
                        <input type="date" value={editBuffer.date} onChange={ev => setEditBuffer({...editBuffer, date: ev.target.value})} className="border rounded px-2 py-1 text-sm" />
                        <input type="text" value={editBuffer.store} onChange={ev => setEditBuffer({...editBuffer, store: ev.target.value})} placeholder="Store" className="border rounded px-2 py-1 text-sm flex-1" />
                      </div>
                    ) : (
                      <div className="font-medium">{r.store} — {r.date}</div>
                    )}
                    <div className="text-sm text-gray-500">Total: ${receiptTotal(isEditing ? editBuffer : r).toFixed(2)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.image && <img src={r.image} alt="receipt" className="h-12 rounded border" />}
                    {isEditing ? (
                      <>
                        <button onClick={async () => {
                          try {
                            const items = editBuffer.items.map(it => ({ ...it, cost: Number(it.cost) || 0 }));
                            const rowToUpdate = { ...editBuffer, items };
                            await api.receipts.update(rowToUpdate);
                            setReceipts(prev => prev.map(x => x.id === r.id ? { ...rowToUpdate, id: r.id } : x));
                            setEditingId(null);
                          } catch (err) { alert('Update failed: ' + err.message); }
                        }}><Save size={16} className="text-green-500" /></button>
                        <button onClick={() => setEditingId(null)}><X size={16} className="text-gray-500" /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditingId(r.id); setEditBuffer({...r, items: r.items.map(it => ({...it}))}); }}><Edit2 size={16} className="text-blue-500" /></button>
                        <button onClick={() => deleteReceipt(r)}><Trash2 size={16} className="text-red-500" /></button>
                      </>
                    )}
                  </div>
                </div>
                <table className="w-full text-sm mt-2">
                  <thead><tr className="text-left text-gray-500 border-b"><th className="py-1">Item</th><th>Category</th><th>Cost</th>{isEditing && <th></th>}</tr></thead>
                  <tbody>
                    {(isEditing ? editBuffer.items : r.items).map((it, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-1">
                          {isEditing ? <input type="text" value={it.name} onChange={ev => {
                            const newItems = [...editBuffer.items];
                            newItems[i] = { ...newItems[i], name: ev.target.value };
                            setEditBuffer({...editBuffer, items: newItems});
                          }} className="border rounded px-1 py-0.5 w-full text-sm" /> : it.name}
                        </td>
                        <td>
                          {isEditing ? (
                            <select value={it.category} onChange={ev => {
                              const newItems = [...editBuffer.items];
                              newItems[i] = { ...newItems[i], category: ev.target.value };
                              setEditBuffer({...editBuffer, items: newItems});
                            }} className="border rounded px-1 py-0.5 text-sm">
                              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          ) : it.category}
                        </td>
                        <td>
                          {isEditing ? <input type="number" step="0.01" value={it.cost} onChange={ev => {
                            const newItems = [...editBuffer.items];
                            newItems[i] = { ...newItems[i], cost: ev.target.value };
                            setEditBuffer({...editBuffer, items: newItems});
                          }} className="border rounded px-1 py-0.5 w-20 text-sm" /> : `$${Number(it.cost).toFixed(2)}`}
                        </td>
                        {isEditing && (
                          <td>
                            <button onClick={() => {
                              const newItems = editBuffer.items.filter((_, idx) => idx !== i);
                              setEditBuffer({...editBuffer, items: newItems});
                            }}><Trash2 size={14} className="text-red-500" /></button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {isEditing && (
                  <button onClick={() => setEditBuffer({...editBuffer, items: [...editBuffer.items, { name: '', cost: '', category: CATEGORIES[0] }]})} className="text-sm text-blue-600 flex items-center gap-1 mt-2"><Plus size={14} />Add Item</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {view === 'reports' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg shadow p-4 md:col-span-2 text-center">
            <div className="text-3xl font-bold">${totalSpent.toFixed(2)}</div>
            <div className="text-sm text-gray-500">Total ({filtered.length} receipts)</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={storeData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="store" width={100} /><Tooltip />
                <Bar dataKey="total" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={categoryData} dataKey="total" nameKey="category" outerRadius={90} label>
                  {categoryData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-lg shadow p-4 md:col-span-2">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={monthTrend}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip />
                <Line type="monotone" dataKey="total" stroke="#ef4444" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

// ================== ROOT ==================
export default function OlympiaNightshiftTracker() {
  const [tab, setTab] = useState('dashboard');
  const [outreach, setOutreach, loadingOutreach] = useCollection(api.outreach.load);
  const [blankets, setBlankets, loadingBlankets] = useCollection(api.blankets.load);
  const [closet, setCloset, loadingCloset] = useCollection(api.closet.load);
  const [receipts, setReceipts, loadingReceipts] = useCollection(api.receipts.load);
  const [donations, setDonations, loadingDonations] = useCollection(api.donations.load);
  const [donors, setDonors, loadingDonors] = useCollection(api.donors.load);
  const [donationItemTypes, setDonationItemTypes] = useState(['Blankets', 'Coats/Hoodies']);

  useEffect(() => {
    if (loadingDonations || donations.length === 0) return;
    setDonationItemTypes(prev => {
      const merged = [...prev];
      donations.forEach(e => Object.keys(e.quantities || {}).forEach(t => { if (!merged.includes(t)) merged.push(t); }));
      return merged;
    });
  }, [loadingDonations, donations]);

  const loading = loadingOutreach || loadingBlankets || loadingCloset || loadingReceipts || loadingDonations || loadingDonors;

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'outreach', label: 'Outreach', icon: Calendar },
    { id: 'blankets', label: 'Blankets', icon: Package },
    { id: 'donations', label: 'Donations', icon: Gift },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'closet', label: 'Closet', icon: Shirt },
    { id: 'receipts', label: 'Receipts', icon: ReceiptIcon },
  ];

  return (
    <>
      {!supabase && <div className="bg-red-50 border-b border-red-200 text-red-700 text-sm p-3 text-center">Supabase not configured.</div>}
      {loading && <div className="bg-yellow-50 border-b border-yellow-200 text-yellow-700 text-sm p-3 text-center">Loading from Supabase…</div>}
      <div className="min-h-screen bg-gray-100">
        <div className="bg-blue-900 text-white p-4">
          <h1 className="text-xl font-bold">Olympia Downtown Nightshift — Data Tracker</h1>
          <p className="text-blue-200 text-sm">Outreach • Blankets • Donations • Contacts • Closet • Receipts</p>
        </div>
        <div className="flex flex-wrap gap-2 p-3 bg-white border-b sticky top-0 z-10">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium ${tab === t.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                <Icon size={16} /> {t.label}
              </button>
            );
          })}
        </div>
        <div className="p-4 max-w-6xl mx-auto">
          {tab === 'dashboard' && <Dashboard outreach={outreach} blankets={blankets} closet={closet} receipts={receipts} donations={donations} donationItemTypes={donationItemTypes} donors={donors} />}
          {tab === 'outreach' && <OutreachTab entries={outreach} setEntries={setOutreach} />}
          {tab === 'blankets' && <BlanketTab entries={blankets} setEntries={setBlankets} />}
          {tab === 'donations' && <DonationTab entries={donations} setEntries={setDonations} itemTypes={donationItemTypes} setItemTypes={setDonationItemTypes} donors={donors} setDonors={setDonors} />}
          {tab === 'contacts' && <ContactsTab donors={donors} setDonors={setDonors} />}
          {tab === 'closet' && <ClosetTab entries={closet} setEntries={setCloset} />}
          {tab === 'receipts' && <ReceiptsTab receipts={receipts} setReceipts={setReceipts} />}
        </div>
      </div>
    </>
  );
}
