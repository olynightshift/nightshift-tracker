import { useState } from 'react';
import { Plus, Download, X, Users, Edit2, Trash2, Save, ChevronLeft, ChevronRight } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { toISO, addDays, startOfWeek, parseISO, MONTHS, downloadCSV, sumQuantitiesByDayInMonth, sumQuantitiesByMonth, sumQuantitiesByYear, sumQuantitiesAllTime, PIE_COLORS } from '../lib/core';
import { DonorFormModal } from '../components/DonorFormModal';
import { useToast } from '../components/toast-context';
import { useUndo } from '../components/undo-context';
import { useConfirm } from '../components/confirm-context';

const todayISO = toISO(new Date());

// ============================================================
// QuantitiesTab — shared implementation for Salvage & Donations
// (config-driven; see SalvageTab.jsx / DonationTab.jsx wrappers)
// ============================================================
export function QuantitiesTab({ config, entries, setEntries, itemTypes, setItemTypes, donors, setDonors }) {
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
  const toast = useToast();
  const { runAction } = useUndo();
  const confirm = useConfirm();

  const donorMap = {}; donors.forEach(d => { donorMap[d.id] = d; });
  const donorLabel = id => (id && donorMap[id]) ? donorMap[id].name : 'Anonymous';

  function addItemType() {
    const name = newItemName.trim();
    if (!name) return;
    if (itemTypes.some(t => t.toLowerCase() === name.toLowerCase())) { toast('That item type already exists.', 'info'); return; }
    setItemTypes(prev => [...prev, name]); setNewItemName('');
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
    if (total === 0) { toast('Enter at least one quantity greater than 0.', 'error'); return; }
    const donorIdNum = formDonorId ? Number(formDonorId) : null;
    const existing = entries.find(e => e.date === formDate && (e.donor_id ?? null) === donorIdNum);
    const merged = existing ? { ...existing.quantities } : {};
    Object.entries(quantities).forEach(([k, v]) => { if (v > 0) merged[k] = (merged[k] || 0) + v; });
    const key = `${formDate}|${donorIdNum ?? 'null'}`;
    const row = { id: key, date: formDate, donor_id: donorIdNum, quantities: merged };
    const ok = await runAction({
      label: `Save ${config.noun.toLowerCase()} entry`,
      doFn: async () => {
        await config.api.upsertEntry(row);
        setEntries(prev => {
          const idx = prev.findIndex(e => e.date === formDate && (e.donor_id ?? null) === donorIdNum);
          if (idx >= 0) { const copy = [...prev]; copy[idx] = row; return copy; }
          return [...prev, row];
        });
      },
      undoFn: async () => {
        if (existing) { await config.api.upsertEntry(existing); setEntries(prev => prev.map(e => e.id === key ? existing : e)); }
        else { await config.api.removeEntry(row); setEntries(prev => prev.filter(e => e.id !== key)); }
      },
    });
    if (ok) { setFormQuantities({}); toast(`${config.noun} entry saved.`, 'success'); }
  }
  async function deleteEntry(row) {
    if (!(await confirm(`Delete this ${config.noun.toLowerCase()} entry from ${row.date}?`))) return;
    const ok = await runAction({
      label: `Delete ${config.noun.toLowerCase()} entry`,
      doFn: async () => { await config.api.removeEntry(row); setEntries(prev => prev.filter(e => e.id !== row.id)); },
      undoFn: async () => { await config.api.upsertEntry(row); setEntries(prev => [...prev, row]); },
    });
    if (ok) toast('Entry deleted.', 'success');
  }
  function exportCSV() {
    const rows = entries.slice().sort((a, b) => a.date.localeCompare(b.date)).map(e => {
      const row = { Date: e.date, [config.contactLabel]: donorLabel(e.donor_id) };
      itemTypes.forEach(t => { row[t] = e.quantities[t] || 0; });
      return row;
    });
    downloadCSV(config.csvFilename, rows);
  }

  const weekStart = startOfWeek(weekAnchor);
  const weekEntries = entries.filter(e => { const d = parseISO(e.date); return d >= weekStart && d <= addDays(weekStart, 6); });
  const monthYear = monthAnchor.getFullYear();
  const monthIdx = monthAnchor.getMonth();
  const monthEntries = entries.filter(e => { const d = parseISO(e.date); return d.getFullYear() === monthYear && d.getMonth() === monthIdx; });

  // A "weight" item type (e.g. Pounds) is a measurement, not a counted item:
  // keep it in the tables, but exclude it from item charts and totals so it
  // doesn't dwarf the actual item counts.
  const weightType = config.weightType ? itemTypes.find(t => t.toLowerCase() === config.weightType.toLowerCase()) : undefined;
  const chartItemTypes = weightType ? itemTypes.filter(t => t !== weightType) : itemTypes;
  const totalWeight = weightType ? entries.reduce((s, e) => s + (Number(e.quantities[weightType]) || 0), 0) : 0;

  const yearData = sumQuantitiesByMonth(entries, yearSelected, chartItemTypes);
  const allYearData = sumQuantitiesByYear(entries, chartItemTypes);
  const allTimeTotals = sumQuantitiesAllTime(entries, chartItemTypes);
  const pieData = chartItemTypes.map(t => ({ name: t, value: allTimeTotals[t] || 0 })).filter(d => d.value > 0);

  const contactTotals = {};
  entries.forEach(e => {
    const key = e.donor_id ?? 'null';
    const total = Object.entries(e.quantities || {}).reduce((s, [t, v]) => s + (weightType && t === weightType ? 0 : (Number(v) || 0)), 0);
    contactTotals[key] = (contactTotals[key] || 0) + total;
  });
  const topContacts = Object.entries(contactTotals)
    .map(([k, v]) => ({ contact: k === 'null' ? 'Anonymous' : (donorMap[Number(k)]?.name || 'Unknown'), total: v }))
    .sort((a, b) => b.total - a.total).slice(0, 10);

  const renderRow = e => {
    const isEditing = editingId === e.id;
    return (
      <tr key={e.id} className="border-b">
        <td className="py-1.5">{isEditing ? <input type="date" value={editBuffer.date} onChange={ev => setEditBuffer({ ...editBuffer, date: ev.target.value })} className="border rounded px-1 py-0.5 text-sm" /> : e.date}</td>
        <td>{isEditing ? (
          <select value={editBuffer.donor_id || ''} onChange={ev => setEditBuffer({ ...editBuffer, donor_id: ev.target.value ? Number(ev.target.value) : null })} className="border rounded px-1 py-0.5 text-sm">
            <option value="">Anonymous</option>{donors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        ) : donorLabel(e.donor_id)}</td>
        {itemTypes.map(t => (
          <td key={t}>{isEditing ? (
            <input type="number" min="0" step="any" value={editBuffer.quantities[t] || 0} onChange={ev => setEditBuffer({ ...editBuffer, quantities: { ...(editBuffer.quantities || {}), [t]: ev.target.value } })} className="border rounded px-1 py-0.5 w-16 text-sm" />
          ) : (e.quantities[t] || 0)}</td>
        ))}
        <td className="flex gap-2">
          {isEditing ? (
            <>
              <button onClick={async () => {
                const cleanQuantities = {};
                itemTypes.forEach(t => { cleanQuantities[t] = Number(editBuffer.quantities[t]) || 0; });
                const rowToUpdate = { ...editBuffer, quantities: cleanQuantities };
                const ok = await runAction({
                  label: `Update ${config.noun.toLowerCase()} entry`,
                  doFn: async () => {
                    await config.api.upsertEntry(rowToUpdate);
                    setEntries(prev => prev.map(x => x.id === e.id ? { ...rowToUpdate, id: e.id } : x));
                  },
                  undoFn: async () => {
                    await config.api.upsertEntry(e);
                    setEntries(prev => prev.map(x => x.id === e.id ? e : x));
                  },
                });
                if (ok) { setEditingId(null); toast('Entry updated.', 'success'); }
              }}><Save size={14} className="text-green-500" /></button>
              <button onClick={() => setEditingId(null)}><X size={14} className="text-gray-500" /></button>
            </>
          ) : (
            <>
              <button onClick={() => { setEditingId(e.id); setEditBuffer({ ...e, quantities: { ...e.quantities } }); }}><Edit2 size={14} className="text-blue-500" /></button>
              <button onClick={() => deleteEntry(e)}><Trash2 size={14} className="text-red-500" /></button>
            </>
          )}
        </td>
      </tr>
    );
  };

  const Icon = config.icon;

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Icon size={20} /> {config.title}</h2>
        <div className="mb-3">
          <div className="text-sm text-gray-600 mb-1">Item types:</div>
          <div className="flex flex-wrap gap-2">
            {itemTypes.map(t => (
              <span key={t} className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${config.chipCls}`}>
                {t}<button onClick={() => removeItemType(t)}><X size={12} /></button>
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 mb-4">
          <input type="text" placeholder="Add item type" value={newItemName} onChange={e => setNewItemName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItemType(); } }} className="border rounded px-2 py-1 text-sm flex-1 max-w-xs" />
          <button onClick={addItemType} className={`${config.btnCls} text-white px-3 py-1.5 rounded text-sm flex items-center gap-1`}><Plus size={14} />Add Type</button>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div><label className="block text-sm text-gray-600 mb-1">Date</label>
            <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className="border rounded px-2 py-1" /></div>
          <div><label className="block text-sm text-gray-600 mb-1 flex items-center gap-1"><Users size={14} /> {config.contactLabel}</label>
            <div className="flex items-center gap-1">
              <select value={formDonorId} onChange={e => setFormDonorId(e.target.value)} className="border rounded px-2 py-1 min-w-40">
                <option value="">— Anonymous —</option>
                {donors.map(d => <option key={d.id} value={d.id}>{d.name}{d.organization ? ` (${d.organization})` : ''}</option>)}
              </select>
              <button type="button" onClick={() => setShowDonorModal(true)} className="bg-cyan-600 text-white px-2 py-1.5 rounded text-sm"><Plus size={14} /></button>
            </div>
          </div>
          {itemTypes.map(t => (
            <div key={t}><label className="block text-sm text-gray-600 mb-1">{t}</label>
              <input type="number" min="0" step="any" value={formQuantities[t] ?? ''} onChange={e => setFormQuantities(prev => ({ ...prev, [t]: e.target.value }))} className="border rounded px-2 py-1 w-24" /></div>
          ))}
          <button onClick={saveEntry} className={`${config.btnCls} text-white px-4 py-1.5 rounded flex items-center gap-1`}><Plus size={16} />Add Entry</button>
          <button onClick={exportCSV} className="ml-auto bg-gray-100 px-3 py-1.5 rounded flex items-center gap-1 text-sm"><Download size={16} />Export CSV</button>
        </div>
      </div>

      <div className="flex gap-2">
        {['week', 'month', 'year', 'all'].map(v => (
          <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded text-sm ${view === v ? `${config.btnCls} text-white` : 'bg-white border'}`}>
            {v === 'week' ? 'Week' : v === 'month' ? 'Month' : v === 'year' ? 'Year' : 'All Time'}
          </button>
        ))}
      </div>

      {view === 'week' && (
        <div className="bg-white rounded-lg shadow p-4 overflow-x-auto">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setWeekAnchor(addDays(weekStart, -7))}><ChevronLeft /></button>
            <span className="font-medium text-sm">{toISO(weekStart)} — {toISO(addDays(weekStart, 6))}</span>
            <button onClick={() => setWeekAnchor(addDays(weekStart, 7))}><ChevronRight /></button>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b"><th className="py-1">Date</th><th>{config.contactLabel}</th>{itemTypes.map(t => <th key={t}>{t}</th>)}<th></th></tr></thead>
            <tbody>
              {weekEntries.sort((a, b) => a.date.localeCompare(b.date)).map(e => renderRow(e))}
              {weekEntries.length === 0 && <tr><td colSpan={itemTypes.length + 3} className="text-center text-gray-400 py-3">No entries this week</td></tr>}
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
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sumQuantitiesByDayInMonth(entries, monthYear, monthIdx, chartItemTypes)}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis allowDecimals={false} /><Tooltip /><Legend />
              {chartItemTypes.map((t, i) => <Bar key={t} dataKey={t} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </BarChart>
          </ResponsiveContainer>
          <table className="w-full text-sm mt-4">
            <thead><tr className="text-left border-b"><th className="py-1">Date</th><th>{config.contactLabel}</th>{itemTypes.map(t => <th key={t}>{t}</th>)}<th></th></tr></thead>
            <tbody>{monthEntries.sort((a, b) => a.date.localeCompare(b.date)).map(e => renderRow(e))}</tbody>
          </table>
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
            <BarChart data={yearData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Legend />
              {chartItemTypes.map((t, i) => <Bar key={t} dataKey={t} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {view === 'all' && (
        <div className="grid md:grid-cols-2 gap-4">
          {weightType && (
            <div className="bg-white rounded-lg shadow p-4 md:col-span-2 flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Total {weightType} collected (all time)</div>
                <div className="text-2xl font-bold">{totalWeight.toLocaleString()} <span className="text-sm font-normal text-gray-500">lbs</span></div>
              </div>
              <div className="text-xs text-gray-400">Weight is tracked separately from item counts in all charts.</div>
            </div>
          )}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-medium mb-2">Split by Item Type</h3>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart><Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart>
              </ResponsiveContainer>
            ) : <div className="text-gray-400 py-8 text-center text-sm">No {config.noun.toLowerCase()} yet</div>}
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-medium mb-2">By Year</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={allYearData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="year" /><YAxis allowDecimals={false} /><Tooltip /><Legend />
                {chartItemTypes.map((t, i) => <Bar key={t} dataKey={t} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-lg shadow p-4 md:col-span-2">
            <h3 className="font-medium mb-2">Top {config.contactLabel}s (by total items)</h3>
            {topContacts.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topContacts} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="contact" width={120} /><Tooltip />
                  <Bar dataKey="total" fill={config.topBarColor} /></BarChart>
              </ResponsiveContainer>
            ) : <div className="text-gray-400 py-4 text-center text-sm">No {config.contactLabel.toLowerCase()} data yet</div>}
          </div>
        </div>
      )}

      {showDonorModal && <DonorFormModal setDonors={setDonors} onClose={() => setShowDonorModal(false)} onSaved={handleDonorSaved} />}
    </div>
  );
}
