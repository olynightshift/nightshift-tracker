import { useState } from 'react';
import { Plus, Download, Edit2, Trash2, Save, X, Shirt, ChevronLeft, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../api';
import { toISO, addDays, startOfWeek, parseISO, MONTHS, downloadCSV, sumByDayInMonth } from '../lib/core';
import { useToast } from '../components/toast-context';
import { useUndo } from '../components/undo-context';
import { useConfirm } from '../components/confirm-context';

const todayISO = toISO(new Date());

// ============================================================
// Closet
// ============================================================
export function ClosetTab({ entries, setEntries }) {
  const [formDate, setFormDate] = useState(todayISO);
  const [peopleCount, setPeopleCount] = useState('');
  const [view, setView] = useState('week');
  const [weekAnchor, setWeekAnchor] = useState(new Date());
  const [monthAnchor, setMonthAnchor] = useState(new Date());
  const [yearSelected, setYearSelected] = useState(new Date().getFullYear());
  const [editingId, setEditingId] = useState(null);
  const [editBuffer, setEditBuffer] = useState({});
  const toast = useToast();
  const { runAction } = useUndo();
  const confirm = useConfirm();

  async function addEntry() {
    if (!peopleCount) { toast('Enter the number of people served.', 'error'); return; }
    const row = { date: formDate, people: Number(peopleCount) || 0 };
    let createdId = null;
    const ok = await runAction({
      label: 'Log closet day',
      doFn: async () => {
        createdId = await api.closet.insert(row);
        setEntries(prev => [...prev, { ...row, id: createdId }]);
      },
      undoFn: async () => {
        if (createdId == null) return;
        await api.closet.remove({ ...row, id: createdId });
        setEntries(prev => prev.filter(e => e.id !== createdId));
      },
    });
    if (ok) { setPeopleCount(''); toast('Closet day saved.', 'success'); }
  }
  async function deleteEntry(row) {
    if (!(await confirm(`Delete the closet entry for ${row.date}?`))) return;
    const ok = await runAction({
      label: 'Delete closet entry',
      doFn: async () => { await api.closet.remove(row); setEntries(prev => prev.filter(e => e.id !== row.id)); },
      undoFn: async () => { const id = await api.closet.insert(row); setEntries(prev => [...prev, { ...row, id }]); },
    });
    if (ok) toast('Entry deleted.', 'success');
  }
  function exportCSV() { downloadCSV('clothing_closet.csv', entries.slice().sort((a, b) => a.date.localeCompare(b.date)).map(e => ({ Date: e.date, 'People Served': e.people }))); }

  const weekStart = startOfWeek(weekAnchor);
  const weekEntries = entries.filter(e => { const d = parseISO(e.date); return d >= weekStart && d <= addDays(weekStart, 6); });
  const monthYear = monthAnchor.getFullYear(); const monthIdx = monthAnchor.getMonth();
  const monthEntries = entries.filter(e => { const d = parseISO(e.date); return d.getFullYear() === monthYear && d.getMonth() === monthIdx; });
  const yearEntries = entries.filter(e => parseISO(e.date).getFullYear() === yearSelected);
  const yearData = MONTHS.map((m, i) => ({ month: m, people: entries.filter(e => { const d = parseISO(e.date); return d.getFullYear() === yearSelected && d.getMonth() === i; }).reduce((s, e) => s + e.people, 0) }));
  const yearMap = {}; entries.forEach(e => { const y = parseISO(e.date).getFullYear(); yearMap[y] = (yearMap[y] || 0) + e.people; });
  const allYearData = Object.entries(yearMap).map(([year, people]) => ({ year, people })).sort((a, b) => a.year - b.year);

  const renderRow = e => {
    const isEditing = editingId === e.id;
    return (
      <tr key={e.id} className="border-b">
        <td className="py-1.5">{isEditing ? <input type="date" value={editBuffer.date} onChange={ev => setEditBuffer({ ...editBuffer, date: ev.target.value })} className="border rounded px-1 py-0.5 text-sm" /> : e.date}</td>
        <td>{isEditing ? <input type="number" value={editBuffer.people} onChange={ev => setEditBuffer({ ...editBuffer, people: ev.target.value })} className="border rounded px-1 py-0.5 w-20 text-sm" /> : e.people}</td>
        <td className="flex gap-2">
          {isEditing ? (
            <>
              <button onClick={async () => {
                const ok = await runAction({
                  label: 'Update closet entry',
                  doFn: async () => {
                    await api.closet.update(editBuffer);
                    setEntries(prev => prev.map(x => x.id === e.id ? { ...editBuffer, id: e.id } : x));
                  },
                  undoFn: async () => {
                    await api.closet.update(e);
                    setEntries(prev => prev.map(x => x.id === e.id ? e : x));
                  },
                });
                if (ok) { setEditingId(null); toast('Entry updated.', 'success'); }
              }}><Save size={14} className="text-green-500" /></button>
              <button onClick={() => setEditingId(null)}><X size={14} className="text-slate-400" /></button>
            </>
          ) : (
            <>
              <button onClick={() => { setEditingId(e.id); setEditBuffer({ ...e }); }}><Edit2 size={14} className="text-sky-400" /></button>
              <button onClick={() => deleteEntry(e)}><Trash2 size={14} className="text-red-500" /></button>
            </>
          )}
        </td>
      </tr>
    );
  };

  const entriesTable = (rows, emptyMsg, sortDesc = false) => (
    <table className="w-full text-sm mt-4">
      <thead><tr className="text-left border-b"><th className="py-1">Date</th><th>People</th><th></th></tr></thead>
      <tbody>
        {rows.slice().sort((a, b) => sortDesc ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)).map(renderRow)}
        {rows.length === 0 && <tr><td colSpan="3" className="text-center text-slate-500 py-3">{emptyMsg}</td></tr>}
      </tbody>
    </table>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-slate-900 rounded-xl shadow-sm border border-slate-700 p-4">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Shirt size={20} /> Log Closet Day</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div><label className="block text-sm text-slate-400 mb-1">Date</label><input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className="border rounded px-2 py-1" /></div>
          <div><label className="block text-sm text-slate-400 mb-1">People Served</label><input type="number" min="0" value={peopleCount} onChange={e => setPeopleCount(e.target.value)} className="border rounded px-2 py-1 w-28" /></div>
          <button onClick={addEntry} className="bg-pink-600 text-white px-4 py-1.5 rounded flex items-center gap-1"><Plus size={16} />Add</button>
          <button onClick={exportCSV} className="ml-auto bg-slate-800 px-3 py-1.5 rounded flex items-center gap-1 text-sm"><Download size={16} />Export CSV</button>
        </div>
      </div>
      <div className="flex gap-2">
        {['week', 'month', 'year', 'all'].map(v => (
          <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded text-sm ${view === v ? 'bg-pink-600 text-white' : 'bg-slate-900 border'}`}>
            {v === 'week' ? 'Week' : v === 'month' ? 'Month' : v === 'year' ? 'Year' : 'All Time'}
          </button>
        ))}
      </div>
      {view === 'week' && (
        <div className="bg-slate-900 rounded-xl shadow-sm border border-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setWeekAnchor(addDays(weekStart, -7))}><ChevronLeft /></button>
            <span className="font-medium text-sm">{toISO(weekStart)} — {toISO(addDays(weekStart, 6))}</span>
            <button onClick={() => setWeekAnchor(addDays(weekStart, 7))}><ChevronRight /></button>
          </div>
          {entriesTable(weekEntries, 'No entries this week')}
        </div>
      )}
      {view === 'month' && (
        <div className="bg-slate-900 rounded-xl shadow-sm border border-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setMonthAnchor(new Date(monthYear, monthIdx - 1, 1))}><ChevronLeft /></button>
            <span className="font-medium">{MONTHS[monthIdx]} {monthYear}</span>
            <button onClick={() => setMonthAnchor(new Date(monthYear, monthIdx + 1, 1))}><ChevronRight /></button>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sumByDayInMonth(entries, monthYear, monthIdx, ['people'])}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis allowDecimals={false} /><Tooltip />
              <Bar dataKey="people" fill="#ec4899" /></BarChart>
          </ResponsiveContainer>
          {entriesTable(monthEntries, 'No entries this month')}
        </div>
      )}
      {view === 'year' && (
        <div className="bg-slate-900 rounded-xl shadow-sm border border-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setYearSelected(y => y - 1)}><ChevronLeft /></button>
            <span className="font-medium">{yearSelected}</span>
            <button onClick={() => setYearSelected(y => y + 1)}><ChevronRight /></button>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={yearData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip />
              <Bar dataKey="people" fill="#ec4899" /></BarChart>
          </ResponsiveContainer>
          {entriesTable(yearEntries, 'No entries this year')}
        </div>
      )}
      {view === 'all' && (
        <div className="bg-slate-900 rounded-xl shadow-sm border border-slate-700 p-4">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={allYearData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="year" /><YAxis allowDecimals={false} /><Tooltip />
              <Bar dataKey="people" fill="#ec4899" /></BarChart>
          </ResponsiveContainer>
          {entriesTable(entries, 'No closet entries yet', true)}
        </div>
      )}
    </div>
  );
}
