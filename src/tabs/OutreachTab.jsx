import { useState, useRef } from 'react';
import { Calendar, Plus, Download, ChevronLeft, ChevronRight, Edit2, Trash2, Save, X } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { api } from '../api';
import { toISO, addDays, startOfWeek, MONTHS, DAYS, downloadCSV, groupOutreachByMonth, groupOutreachByYear } from '../lib/core';
import { useToast } from '../components/toast-context';

const todayISO = toISO(new Date());

// ============================================================
// Outreach
// ============================================================
export function OutreachTab({ entries, setEntries }) {
  const [formDate, setFormDate] = useState(todayISO);
  const [formNightshift, setFormNightshift] = useState(false);
  const [formCoffee, setFormCoffee] = useState(false);
  const [view, setView] = useState('week');
  const [weekAnchor, setWeekAnchor] = useState(new Date());
  const [monthAnchor, setMonthAnchor] = useState(new Date());
  const [yearSelected, setYearSelected] = useState(new Date().getFullYear());
  const [editingId, setEditingId] = useState(null);
  const [editBuffer, setEditBuffer] = useState({});
  const formRef = useRef(null);
  const toast = useToast();

  const entryMap = {};
  entries.forEach(e => { entryMap[e.date] = e; });

  function loadDay(dateISO) {
    setFormDate(dateISO);
    const e = entryMap[dateISO];
    setFormNightshift(e ? e.nightshift : false);
    setFormCoffee(e ? e.coffee : false);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async function saveEntry() {
    const row = { id: formDate, date: formDate, nightshift: formNightshift, coffee: formCoffee };
    if (!formNightshift && !formCoffee) {
      if (entryMap[formDate]) {
        try { await api.outreach.remove(row); setEntries(prev => prev.filter(e => e.date !== formDate)); toast('Entry removed.', 'success'); }
        catch (err) { toast('Delete failed: ' + err.message, 'error'); }
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
      toast('Outreach day saved.', 'success');
    } catch (err) { toast('Save failed: ' + err.message, 'error'); }
  }
  async function deleteEntry(date) {
    try { await api.outreach.remove({ date }); setEntries(prev => prev.filter(e => e.date !== date)); toast('Entry deleted.', 'success'); }
    catch (err) { toast('Delete failed: ' + err.message, 'error'); }
  }
  function exportCSV() {
    const rows = entries.slice().sort((a, b) => a.date.localeCompare(b.date)).map(e => ({ Date: e.date, Nightshift: e.nightshift ? 'Yes' : 'No', Coffee: e.coffee ? 'Yes' : 'No' }));
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
  const pieData = [{ name: 'Nightshift', value: entries.filter(e => e.nightshift).length }, { name: 'Coffee', value: entries.filter(e => e.coffee).length }];

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-lg shadow p-4" ref={formRef}>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Calendar size={20} /> Log Outreach Day</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div><label className="block text-sm text-gray-600 mb-1">Date</label>
            <input type="date" value={formDate} onChange={e => loadDay(e.target.value)} className="border rounded px-2 py-1" /></div>
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
                const iso = toISO(d); const e = entryMap[iso]; const isEditing = editingId === iso;
                return (
                  <tr key={iso} className="border-b hover:bg-gray-50">
                    <td className="py-1.5">{DAYS[d.getDay()]}</td><td>{iso}</td>
                    <td>{isEditing ? <input type="checkbox" checked={editBuffer.nightshift} onChange={ev => setEditBuffer({ ...editBuffer, nightshift: ev.target.checked })} /> : (e?.nightshift ? '✅' : '—')}</td>
                    <td>{isEditing ? <input type="checkbox" checked={editBuffer.coffee} onChange={ev => setEditBuffer({ ...editBuffer, coffee: ev.target.checked })} /> : (e?.coffee ? '✅' : '—')}</td>
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
                              toast('Entry updated.', 'success');
                            } catch (err) { toast('Update failed: ' + err.message, 'error'); }
                          }}><Save size={14} className="text-green-500" /></button>
                          <button onClick={() => setEditingId(null)}><X size={14} className="text-gray-500" /></button>
                        </>
                      ) : (
                        <>
                          {e && <button onClick={() => { setEditingId(iso); setEditBuffer({ ...e }); }}><Edit2 size={14} className="text-blue-500" /></button>}
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
              const iso = toISO(d); const e = entryMap[iso]; const inMonth = d.getMonth() === monthIdx;
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
            <BarChart data={yearData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Legend />
              <Bar dataKey="nightshift" fill="#3b82f6" /><Bar dataKey="coffee" fill="#f59e0b" /></BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {view === 'all' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart><Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80} label>
                {pieData.map((_, i) => <Cell key={i} fill={i === 0 ? '#3b82f6' : '#f59e0b'} />)}</Pie><Tooltip /><Legend /></PieChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={allYearData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="year" /><YAxis allowDecimals={false} /><Tooltip /><Legend />
                <Bar dataKey="nightshift" fill="#3b82f6" /><Bar dataKey="coffee" fill="#f59e0b" /></BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
