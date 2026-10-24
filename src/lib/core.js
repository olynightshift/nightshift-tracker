import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

export const TABLES = {
  outreach: 'outreach_calendar',
  salvage: 'salvage',
  donations: 'donations',
  closet: 'clothing_closet',
  receipts: 'receipts',
  receiptItems: 'receipt_items',
  donors: 'donors',
};

export const pad = n => String(n).padStart(2, '0');
export const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => { const r = new Date(d.getFullYear(), d.getMonth(), d.getDate()); r.setDate(r.getDate() + n); return r; };
export const startOfWeek = d => { const r = new Date(d.getFullYear(), d.getMonth(), d.getDate()); r.setDate(r.getDate() - r.getDay()); return r; };
export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
export const todayISO = toISO(new Date());
export const PIE_COLORS = ['#8b5cf6','#14b8a6','#f59e0b','#3b82f6','#22c55e','#ec4899','#ef4444','#6366f1','#84cc16','#06b6d4'];

// Food splits three ways: crew meals vs. outreach coffee supplies vs. other food.
// Tax is NOT a spending category — it lives in receipts.tax and is displayed
// separately from category totals everywhere.
export const RECEIPT_CATEGORIES = ['Food — Employee/Volunteer','Food — Coffee Supplies','Food — Other','Cleaning Supplies','Laundry','Fuel/Transportation','Vehicle Maintenance','Office Supplies','Blankets/Clothing Purchase','Utilities','Other'];
export const TAX_NAME_REGEX = /(^|\s)(sales|state|wa|city|county|excise)?\s*tax(es)?(\s|$)/i;

export function downloadCSV(filename, rows) {
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
export function groupOutreachByMonth(entries, year) {
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
export function groupOutreachByYear(entries) {
  const map = {};
  entries.forEach(e => {
    const y = parseISO(e.date).getFullYear();
    if (!map[y]) map[y] = { year: y, nightshift: 0, coffee: 0 };
    if (e.nightshift) map[y].nightshift++;
    if (e.coffee) map[y].coffee++;
  });
  return Object.values(map).sort((a, b) => a.year - b.year);
}
export function receiptSubtotal(r) { return r.items.reduce((s, it) => s + (Number(it.cost) || 0), 0); }
export function receiptTax(r) { return Number(r.tax) || 0; }
export function receiptTotal(r) { return receiptSubtotal(r) + receiptTax(r); }
// Line items that are really tax in disguise (legacy/manual entry) — used to
// fold them into the tax field instead of treating them as purchased items.
export function isTaxLineItem(it) { return TAX_NAME_REGEX.test(it.name || ''); }
export function sumReceiptsByStore(receipts) {
  const map = {};
  receipts.forEach(r => { map[r.store] = (map[r.store] || 0) + receiptTotal(r); });
  return Object.entries(map).map(([store, total]) => ({ store, total })).sort((a, b) => b.total - a.total);
}
export function sumReceiptsByCategory(receipts) {
  const map = {};
  receipts.forEach(r => r.items.forEach(it => {
    if (isTaxLineItem(it)) return; // tax never counts as a spending category
    const cat = it.category || 'Other';
    map[cat] = (map[cat] || 0) + (Number(it.cost) || 0);
  }));
  return Object.entries(map).map(([category, total]) => ({ category, total }));
}
export function sumReceiptTax(receipts) {
  return receipts.reduce((s, r) => s + receiptTax(r) + r.items.reduce((ss, it) => ss + (isTaxLineItem(it) ? (Number(it.cost) || 0) : 0), 0), 0);
}
export function sumByDayInMonth(entries, year, month, keys) {
  const map = {};
  entries.forEach(e => {
    const d = parseISO(e.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!map[day]) { map[day] = { day }; keys.forEach(k => map[day][k] = 0); }
      keys.forEach(k => map[day][k] += Number(e.quantities?.[k] ?? e[k]) || 0);
    }
  });
  return Object.values(map).sort((a, b) => a.day - b.day);
}
export function sumQuantitiesByDayInMonth(entries, year, month, itemTypes) {
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
export function sumQuantitiesByMonth(entries, year, itemTypes) {
  const data = MONTHS.map(m => { const o = { month: m }; itemTypes.forEach(t => o[t] = 0); return o; });
  entries.forEach(e => {
    const d = parseISO(e.date);
    if (d.getFullYear() === year) {
      itemTypes.forEach(t => { data[d.getMonth()][t] += Number(e.quantities[t]) || 0; });
    }
  });
  return data;
}
export function sumQuantitiesByYear(entries, itemTypes) {
  const map = {};
  entries.forEach(e => {
    const y = parseISO(e.date).getFullYear();
    if (!map[y]) { map[y] = { year: y }; itemTypes.forEach(t => map[y][t] = 0); }
    itemTypes.forEach(t => { map[y][t] += Number(e.quantities[t]) || 0; });
  });
  return Object.values(map).sort((a, b) => a.year - b.year);
}
export function sumQuantitiesAllTime(entries, itemTypes) {
  const totals = {};
  itemTypes.forEach(t => { totals[t] = entries.reduce((s, e) => s + (Number(e.quantities[t]) || 0), 0); });
  return totals;
}
