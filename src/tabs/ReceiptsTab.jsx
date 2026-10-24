import { useState, useEffect, useMemo } from 'react';
import { Receipt as ReceiptIcon, Plus, Download, List, Grid3x3, Search, FileText, ChevronLeft, ChevronRight, Tag, Store, DollarSign, Edit2, Trash2 } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { api } from '../api';
import { RECEIPT_CATEGORIES, PIE_COLORS, downloadCSV, receiptTotal, sumReceiptsByStore, sumReceiptsByCategory } from '../lib/core';
import { buildItemCatalogue } from '../lib/receipts';
import { ReceiptFormModal } from '../components/ReceiptFormModal';
import { useToast } from '../components/toast-context';
import { useUndo } from '../components/undo-context';
import { useConfirm } from '../components/confirm-context';

// ============================================================
// Receipts Tab — Browse / Items / Reports with multi-field search
// ============================================================
export function ReceiptsTab({ receipts, setReceipts }) {
  const [view, setView] = useState('browse'); // browse | items | results | reports
  const [showModal, setShowModal] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState(null);
  const toast = useToast();
  const { runAction } = useUndo();
  const confirm = useConfirm();

  // Search filters (shared across views)
  const [itemQ, setItemQ] = useState('');
  const [storeQ, setStoreQ] = useState('');
  const [category, setCategory] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [minCost, setMinCost] = useState('');
  const [maxCost, setMaxCost] = useState('');

  function clearFilters() {
    setItemQ(''); setStoreQ(''); setCategory('All'); setDateFrom(''); setDateTo(''); setMinCost(''); setMaxCost('');
  }

  // --- derived data ---
  const filteredReceipts = useMemo(() => {
    return receipts.filter(r => {
      if (storeQ && !r.store.toLowerCase().includes(storeQ.toLowerCase())) return false;
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;
      if (category !== 'All' && !r.items.some(it => it.category === category)) return false;
      if (itemQ) {
        const q = itemQ.toLowerCase();
        if (!r.items.some(it => (it.name || '').toLowerCase().includes(q))) return false;
      }
      if (minCost && !r.items.some(it => Number(it.cost) >= Number(minCost))) return false;
      if (maxCost && !r.items.some(it => Number(it.cost) <= Number(maxCost))) return false;
      return true;
    });
  }, [receipts, itemQ, storeQ, category, dateFrom, dateTo, minCost, maxCost]);

  // Flat list of items that match filters (for item-level search)
  const matchingItems = useMemo(() => {
    const out = [];
    receipts.forEach(r => {
      if (storeQ && !r.store.toLowerCase().includes(storeQ.toLowerCase())) return;
      if (dateFrom && r.date < dateFrom) return;
      if (dateTo && r.date > dateTo) return;
      r.items.forEach(it => {
        if (category !== 'All' && it.category !== category) return;
        if (itemQ && !(it.name || '').toLowerCase().includes(itemQ.toLowerCase())) return;
        const cost = Number(it.cost) || 0;
        if (minCost && cost < Number(minCost)) return;
        if (maxCost && cost > Number(maxCost)) return;
        out.push({ ...it, cost, receiptId: r.id, date: r.date, store: r.store });
      });
    });
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }, [receipts, itemQ, storeQ, category, dateFrom, dateTo, minCost, maxCost]);

  const catalogue = useMemo(() => buildItemCatalogue(receipts), [receipts]);
  const filteredCatalogue = useMemo(() => {
    return catalogue.filter(ci => {
      if (itemQ && !ci.name.toLowerCase().includes(itemQ.toLowerCase())) return false;
      if (storeQ && !ci.stores.some(s => s.toLowerCase().includes(storeQ.toLowerCase()))) return false;
      if (category !== 'All' && !ci.categories.includes(category)) return false;
      if (dateFrom && ci.lastDate && ci.lastDate < dateFrom) return false;
      if (dateTo && ci.firstDate && ci.firstDate > dateTo) return false;
      if (minCost && ci.avgCost < Number(minCost)) return false;
      if (maxCost && ci.avgCost > Number(maxCost)) return false;
      return true;
    });
  }, [catalogue, itemQ, storeQ, category, dateFrom, dateTo, minCost, maxCost]);

  async function deleteReceipt(r) {
    if (!(await confirm(`Delete receipt from ${r.store} on ${r.date}?`))) return;
    const ok = await runAction({
      label: 'Delete receipt',
      doFn: async () => { await api.receipts.remove(r); setReceipts(prev => prev.filter(x => x.id !== r.id)); },
      undoFn: async () => {
        const id = await api.receipts.insert(r);
        setReceipts(prev => [...prev, { ...r, id }]);
      },
    });
    if (ok) toast('Receipt deleted.', 'success');
  }

  function handleSaved(row) {
    setReceipts(prev => {
      const idx = prev.findIndex(x => x.id === row.id);
      if (idx >= 0) { const copy = [...prev]; copy[idx] = row; return copy; }
      return [...prev, row];
    });
  }

  function exportReceiptsCSV() {
    const rows = [];
    filteredReceipts.forEach(r => r.items.forEach(it => rows.push({
      Date: r.date, Store: r.store, Item: it.name, Category: it.category, Cost: Number(it.cost).toFixed(2),
    })));
    downloadCSV('receipts_filtered.csv', rows.sort((a, b) => a.Date.localeCompare(b.Date)));
  }
  function exportCatalogueCSV() {
    downloadCSV('item_catalogue.csv', filteredCatalogue.map(ci => ({
      Item: ci.name, 'Times Purchased': ci.count, 'Total Spent': ci.totalSpent.toFixed(2),
      'Avg Cost': ci.avgCost.toFixed(2), 'First Seen': ci.firstDate, 'Last Seen': ci.lastDate,
      Stores: ci.stores.join('; '), Categories: ci.categories.join('; '),
    })));
  }

  // Scroll-through state for browse view
  const [focusIdx, setFocusIdx] = useState(0);
  const sortedReceipts = useMemo(() => filteredReceipts.slice().sort((a, b) => b.date.localeCompare(a.date)), [filteredReceipts]);
  useEffect(() => { setFocusIdx(0); }, [sortedReceipts.length, itemQ, storeQ, category, dateFrom, dateTo, minCost, maxCost]);
  const focusedReceipt = sortedReceipts[focusIdx];

  // Reports data
  const totalSpent = filteredReceipts.reduce((s, r) => s + receiptTotal(r), 0);
  const storeData = sumReceiptsByStore(filteredReceipts);
  const categoryData = sumReceiptsByCategory(filteredReceipts);
  const monthMap = {};
  filteredReceipts.forEach(r => { const key = r.date.slice(0, 7); monthMap[key] = (monthMap[key] || 0) + receiptTotal(r); });
  const monthTrend = Object.entries(monthMap).sort((a, b) => a[0].localeCompare(b[0])).map(([month, total]) => ({ month, total }));

  // Item-focus view (click an item in catalogue to see purchase history)
  const [focusedItem, setFocusedItem] = useState(null);

  return (
    <div className="flex flex-col gap-6">
      {/* Top bar: title + add */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold flex items-center gap-2"><ReceiptIcon size={20} /> Receipts</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => { setEditingReceipt(null); setShowModal(true); }} className="bg-indigo-600 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1"><Plus size={14} />Add Receipt</button>
          {view === 'items' ? (
            <button onClick={exportCatalogueCSV} className="bg-gray-100 px-3 py-1.5 rounded flex items-center gap-1 text-sm"><Download size={14} />Export Catalogue</button>
          ) : (
            <button onClick={exportReceiptsCSV} className="bg-gray-100 px-3 py-1.5 rounded flex items-center gap-1 text-sm"><Download size={14} />Export Receipts</button>
          )}
        </div>
      </div>

      {/* Unified search panel */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="text-sm font-medium mb-2 text-gray-700">Search & Filter</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="block text-xs text-gray-500 mb-1 flex items-center gap-1"><Tag size={12} />Item contains</label>
            <input type="text" value={itemQ} onChange={e => setItemQ(e.target.value)} placeholder="e.g. coffee" className="border rounded px-2 py-1 w-full text-sm" /></div>
          <div><label className="block text-xs text-gray-500 mb-1 flex items-center gap-1"><Store size={12} />Store contains</label>
            <input type="text" value={storeQ} onChange={e => setStoreQ(e.target.value)} placeholder="e.g. Costco" className="border rounded px-2 py-1 w-full text-sm" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="border rounded px-2 py-1 w-full text-sm">
              <option>All</option>{RECEIPT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select></div>
          <div><label className="block text-xs text-gray-500 mb-1 flex items-center gap-1"><DollarSign size={12} />Cost range</label>
            <div className="flex gap-1">
              <input type="number" step="0.01" value={minCost} onChange={e => setMinCost(e.target.value)} placeholder="min" className="border rounded px-2 py-1 w-full text-sm" />
              <input type="number" step="0.01" value={maxCost} onChange={e => setMaxCost(e.target.value)} placeholder="max" className="border rounded px-2 py-1 w-full text-sm" />
            </div></div>
          <div><label className="block text-xs text-gray-500 mb-1">Date from</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border rounded px-2 py-1 w-full text-sm" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Date to</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border rounded px-2 py-1 w-full text-sm" /></div>
          <div className="col-span-2 flex items-end"><button onClick={clearFilters} className="text-sm text-blue-600 underline">Clear all filters</button></div>
        </div>
        <div className="text-xs text-gray-500 mt-2">
          Matches: {filteredReceipts.length} receipts · {matchingItems.length} line items · {filteredCatalogue.length} unique items
        </div>
      </div>

      {/* View switcher */}
      <div className="flex gap-2 flex-wrap">
        {[
          { k: 'browse', label: 'Browse Receipts', icon: List },
          { k: 'items', label: 'Item Catalogue', icon: Grid3x3 },
          { k: 'results', label: 'Matching Line Items', icon: Search },
          { k: 'reports', label: 'Reports', icon: FileText },
        ].map(v => (
          <button key={v.k} onClick={() => setView(v.k)} className={`px-3 py-1.5 rounded text-sm flex items-center gap-1 ${view === v.k ? 'bg-indigo-600 text-white' : 'bg-white border'}`}>
            <v.icon size={14} />{v.label}
          </button>
        ))}
      </div>

      {/* ---------- BROWSE: scroll one-by-one + list ---------- */}
      {view === 'browse' && (
        <div className="flex flex-col gap-4">
          {sortedReceipts.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-gray-400">No receipts match the filters.</div>
          ) : (
            <>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <button onClick={() => setFocusIdx(i => Math.max(0, i - 1))} disabled={focusIdx === 0} className="disabled:opacity-30"><ChevronLeft /></button>
                  <div className="text-sm text-gray-600">Receipt {focusIdx + 1} of {sortedReceipts.length}</div>
                  <button onClick={() => setFocusIdx(i => Math.min(sortedReceipts.length - 1, i + 1))} disabled={focusIdx >= sortedReceipts.length - 1} className="disabled:opacity-30"><ChevronRight /></button>
                </div>
                {focusedReceipt && (
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-lg font-semibold">{focusedReceipt.store}</div>
                          <div className="text-sm text-gray-500">{focusedReceipt.date}</div>
                          <div className="text-sm font-medium mt-1">Total: ${receiptTotal(focusedReceipt).toFixed(2)}</div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => { setEditingReceipt(focusedReceipt); setShowModal(true); }} title="Edit"><Edit2 size={16} className="text-blue-500" /></button>
                          <button onClick={() => deleteReceipt(focusedReceipt)} title="Delete"><Trash2 size={16} className="text-red-500" /></button>
                        </div>
                      </div>
                      <table className="w-full text-sm mt-3">
                        <thead><tr className="text-left text-gray-500 border-b"><th className="py-1">Item</th><th>Category</th><th className="text-right">Cost</th></tr></thead>
                        <tbody>
                          {focusedReceipt.items.map((it, i) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="py-1">{it.name}</td>
                              <td className="text-xs text-gray-600">{it.category}</td>
                              <td className="text-right">${Number(it.cost).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {focusedReceipt.image && (
                      <div className="md:w-56 shrink-0">
                        <img src={focusedReceipt.image} alt="receipt" className="w-full rounded border" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50"><tr className="text-left border-b"><th className="p-2">Date</th><th>Store</th><th>Items</th><th>Categories</th><th className="text-right">Total</th><th></th></tr></thead>
                  <tbody>
                    {sortedReceipts.map((r, i) => (
                      <tr key={r.id} className={`border-b hover:bg-gray-50 cursor-pointer ${i === focusIdx ? 'bg-indigo-50' : ''}`} onClick={() => setFocusIdx(i)}>
                        <td className="p-2">{r.date}</td>
                        <td className="font-medium">{r.store}</td>
                        <td>{r.items.length}</td>
                        <td className="text-xs text-gray-600">{[...new Set(r.items.map(it => it.category))].join(', ')}</td>
                        <td className="text-right">${receiptTotal(r).toFixed(2)}</td>
                        <td className="flex gap-2 p-2">
                          <button onClick={e => { e.stopPropagation(); setEditingReceipt(r); setShowModal(true); }}><Edit2 size={14} className="text-blue-500" /></button>
                          <button onClick={e => { e.stopPropagation(); deleteReceipt(r); }}><Trash2 size={14} className="text-red-500" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ---------- ITEM CATALOGUE ---------- */}
      {view === 'items' && (
        <div className="flex flex-col gap-4">
          {focusedItem ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">{focusedItem.name}</h3>
                <button onClick={() => setFocusedItem(null)} className="text-sm text-blue-600 underline">← Back to catalogue</button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                <div className="bg-gray-50 rounded p-2 text-center"><div className="text-xs text-gray-500">Times purchased</div><div className="text-xl font-bold">{focusedItem.count}</div></div>
                <div className="bg-gray-50 rounded p-2 text-center"><div className="text-xs text-gray-500">Total spent</div><div className="text-xl font-bold">${focusedItem.totalSpent.toFixed(2)}</div></div>
                <div className="bg-gray-50 rounded p-2 text-center"><div className="text-xs text-gray-500">Avg cost</div><div className="text-xl font-bold">${focusedItem.avgCost.toFixed(2)}</div></div>
                <div className="bg-gray-50 rounded p-2 text-center"><div className="text-xs text-gray-500">First seen</div><div className="text-sm font-bold">{focusedItem.firstDate || '—'}</div></div>
                <div className="bg-gray-50 rounded p-2 text-center"><div className="text-xs text-gray-500">Last seen</div><div className="text-sm font-bold">{focusedItem.lastDate || '—'}</div></div>
              </div>
              <div className="text-sm mb-2">
                <span className="text-gray-500">Stores:</span> {focusedItem.stores.join(', ')} ·
                <span className="text-gray-500 ml-2">Categories:</span> {focusedItem.categories.join(', ')}
              </div>
              <table className="w-full text-sm">
                <thead><tr className="text-left border-b bg-gray-50"><th className="p-2">Date</th><th>Store</th><th>Category</th><th className="text-right">Cost</th><th></th></tr></thead>
                <tbody>
                  {focusedItem.purchases.slice().sort((a, b) => b.date.localeCompare(a.date)).map((p, i) => {
                    const parentReceipt = receipts.find(r => r.id === p.receiptId);
                    return (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="p-2">{p.date}</td>
                        <td>{p.store}</td>
                        <td className="text-xs text-gray-600">{p.category}</td>
                        <td className="text-right">${p.cost.toFixed(2)}</td>
                        <td>{parentReceipt && (
                          <button onClick={() => { setEditingReceipt(parentReceipt); setShowModal(true); }} className="text-xs text-blue-600 underline">View receipt</button>
                        )}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr className="text-left border-b"><th className="p-2">Item</th><th>Times</th><th>Total $</th><th>Avg $</th><th>Last seen</th><th>Stores</th><th>Categories</th></tr></thead>
                <tbody>
                  {filteredCatalogue.map(ci => (
                    <tr key={ci.key} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => setFocusedItem(ci)}>
                      <td className="p-2 font-medium text-blue-700">{ci.name}</td>
                      <td>{ci.count}</td>
                      <td>${ci.totalSpent.toFixed(2)}</td>
                      <td>${ci.avgCost.toFixed(2)}</td>
                      <td className="text-xs">{ci.lastDate}</td>
                      <td className="text-xs text-gray-600 max-w-xs truncate">{ci.stores.join(', ')}</td>
                      <td className="text-xs text-gray-600">{ci.categories.join(', ')}</td>
                    </tr>
                  ))}
                  {filteredCatalogue.length === 0 && <tr><td colSpan="7" className="text-center text-gray-400 py-6">No items match the filters.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ---------- MATCHING LINE ITEMS (flat view) ---------- */}
      {view === 'results' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr className="text-left border-b"><th className="p-2">Date</th><th>Store</th><th>Item</th><th>Category</th><th className="text-right">Cost</th><th></th></tr></thead>
            <tbody>
              {matchingItems.map((it, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="p-2">{it.date}</td>
                  <td>{it.store}</td>
                  <td className="font-medium">{it.name}</td>
                  <td className="text-xs text-gray-600">{it.category}</td>
                  <td className="text-right">${it.cost.toFixed(2)}</td>
                  <td><button onClick={() => { const r = receipts.find(x => x.id === it.receiptId); if (r) { setEditingReceipt(r); setShowModal(true); } }} className="text-xs text-blue-600 underline">View receipt</button></td>
                </tr>
              ))}
              {matchingItems.length === 0 && <tr><td colSpan="6" className="text-center text-gray-400 py-6">No line items match the filters.</td></tr>}
            </tbody>
          </table>
          <div className="p-2 text-xs text-gray-500 border-t">
            Subtotal of matching line items: ${matchingItems.reduce((s, it) => s + it.cost, 0).toFixed(2)}
          </div>
        </div>
      )}

      {/* ---------- REPORTS ---------- */}
      {view === 'reports' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:col-span-2 text-center">
            <div className="text-3xl font-bold">${totalSpent.toFixed(2)}</div>
            <div className="text-sm text-gray-500">Total across {filteredReceipts.length} receipts (filtered)</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <h3 className="font-medium mb-2">By Store</h3>
            {storeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={storeData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="store" width={100} /><Tooltip />
                  <Bar dataKey="total" fill="#6366f1" /></BarChart>
              </ResponsiveContainer>
            ) : <div className="text-gray-400 py-8 text-center text-sm">No data</div>}
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <h3 className="font-medium mb-2">By Category</h3>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart><Pie data={categoryData} dataKey="total" nameKey="category" outerRadius={90} label>
                  {categoryData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart>
              </ResponsiveContainer>
            ) : <div className="text-gray-400 py-8 text-center text-sm">No data</div>}
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:col-span-2">
            <h3 className="font-medium mb-2">Monthly Spend</h3>
            {monthTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={monthTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip />
                  <Line type="monotone" dataKey="total" stroke="#ef4444" strokeWidth={2} /></LineChart>
              </ResponsiveContainer>
            ) : <div className="text-gray-400 py-8 text-center text-sm">No data</div>}
          </div>
        </div>
      )}

      {showModal && <ReceiptFormModal receipt={editingReceipt} setReceipts={setReceipts} onClose={() => setShowModal(false)} onSaved={handleSaved} />}
    </div>
  );
}
