import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Activity, DollarSign, Landmark, Package, Users } from 'lucide-react';
import { groupOutreachByYear, receiptTotal, sumQuantitiesAllTime, sumReceiptTax, PIE_COLORS } from '../lib/core';

// ============================================================
// Reports & Analytics — the year-over-year, by-type, and
// money-deep-dive view. Complements the Dashboard's last-30-days
// focus with all-time and per-year trends.
// ============================================================
export function ReportsTab({ outreach, salvage, closet, receipts, donations, salvageItemTypes, donationItemTypes, donors }) {
  // Pounds is a weight measurement, not a counted item — track it separately.
  const weightType = salvageItemTypes.find(t => t.toLowerCase() === 'pounds');
  const itemTypes = weightType ? salvageItemTypes.filter(t => t !== weightType) : salvageItemTypes;
  const totalPounds = weightType ? salvage.reduce((s, e) => s + (Number(e.quantities[weightType]) || 0), 0) : 0;

  const totalSpent = receipts.reduce((s, r) => s + receiptTotal(r), 0);
  const totalTax = sumReceiptTax(receipts);
  const totalPeople = closet.reduce((s, e) => s + e.people, 0);
  const totalSalvageItems = Object.values(sumQuantitiesAllTime(salvage, itemTypes)).reduce((s, v) => s + v, 0);
  const totalDonatedItems = donations.reduce((s, e) => s + Object.values(e.quantities).reduce((ss, v) => ss + (Number(v) || 0), 0), 0);

  const kpis = [
    { label: 'Total Expenses (incl. tax)', value: '$' + totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), icon: DollarSign, valCls: 'text-rose-600' },
    { label: 'Sales Tax Paid', value: '$' + totalTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), icon: Landmark, valCls: 'text-amber-600' },
    { label: 'People Served (closet)', value: totalPeople.toLocaleString(), icon: Users, valCls: 'text-purple-600' },
    { label: weightType ? 'Textiles / Items Salvaged' : 'Items Salvaged', value: weightType ? `${totalPounds.toLocaleString()} lbs · ${totalSalvageItems.toLocaleString()} items` : totalSalvageItems.toLocaleString(), icon: Package, valCls: 'text-teal-600' },
  ];

  // Outreach by year (all years on record)
  const yearData = groupOutreachByYear(outreach);

  // Monthly spend + tax trend (two lines: money out the door vs. tax portion)
  const monthMap = {}; const taxMap = {};
  receipts.forEach(r => {
    const key = r.date.slice(0, 7);
    monthMap[key] = (monthMap[key] || 0) + receiptTotal(r);
    taxMap[key] = (taxMap[key] || 0) + (Number(r.tax) || 0);
  });
  const monthTrend = Object.keys(monthMap).sort().map(m => ({ month: m, spent: Math.round(monthMap[m] * 100) / 100, tax: Math.round((taxMap[m] || 0) * 100) / 100 }));

  // Item-type breakdowns (all time)
  const salvageByType = Object.entries(sumQuantitiesAllTime(salvage, itemTypes)).map(([type, total]) => ({ type, total })).sort((a, b) => b.total - a.total);
  const donationByType = Object.entries(sumQuantitiesAllTime(donations, donationItemTypes)).map(([type, total]) => ({ type, total })).sort((a, b) => b.total - a.total);

  // Donor leaderboard (all time)
  const donorTotals = {};
  donations.forEach(e => {
    const key = e.donor_id ?? 'null';
    const total = Object.values(e.quantities || {}).reduce((s, v) => s + (Number(v) || 0), 0);
    donorTotals[key] = (donorTotals[key] || 0) + total;
  });
  const donorMap = {}; donors.forEach(d => { donorMap[d.id] = d; });
  const topDonors = Object.entries(donorTotals)
    .map(([k, v]) => ({ donor: k === 'null' ? 'Anonymous' : (donorMap[Number(k)]?.name || 'Unknown'), total: v }))
    .sort((a, b) => b.total - a.total).slice(0, 10);

  // Full recent activity across every module
  const itemCount = e => Object.entries(e.quantities || {}).reduce((s, [t, v]) => s + (weightType && t === weightType ? 0 : (Number(v) || 0)), 0);
  const donorName = id => (id && donorMap[id]) ? donorMap[id].name : 'Anonymous';
  const activity = [
    ...outreach.map(e => ({
      date: e.date,
      dotCls: 'bg-sky-500',
      text: [e.nightshift && 'Nightshift outreach', e.coffee && 'Mission Coffee'].filter(Boolean).join(' + '),
    })),
    ...closet.map(e => ({ date: e.date, dotCls: 'bg-purple-500', text: `${e.people} people served at the closet` })),
    ...salvage.map(e => ({ date: e.date, dotCls: 'bg-teal-500', text: `${itemCount(e)} salvage items from ${donorName(e.donor_id)}` })),
    ...donations.map(e => ({ date: e.date, dotCls: 'bg-pink-500', text: `${Object.values(e.quantities || {}).reduce((s, v) => s + (Number(v) || 0), 0)} items donated by ${donorName(e.donor_id)}` })),
    ...receipts.map(r => ({ date: r.date, dotCls: 'bg-rose-500', text: `Receipt: $${receiptTotal(r).toFixed(2)} at ${r.store}` })),
  ].sort((a, b) => b.date.localeCompare(a.date) || (b.text > a.text ? 1 : -1)).slice(0, 30);

  const card = 'bg-slate-900 rounded-xl shadow-sm border border-slate-700 p-6';
  const cardTitle = 'text-lg font-semibold text-slate-100 mb-4';
  const empty = (msg) => <div className="text-slate-400 text-sm h-[220px] flex items-center justify-center">{msg}</div>;
  const axis = { fontSize: 10, fill: '#94a3b8' };

  return (
    <div className="fade-in">
      <h2 className="text-2xl font-bold text-slate-100 mb-6">Reports &amp; Analytics</h2>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {kpis.map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="stat-card bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-700">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-slate-400 truncate">{k.label}</p>
                  <p className={`text-2xl font-bold ${k.valCls}`}>{k.value}</p>
                </div>
                <div className="bg-slate-800 p-3 rounded-lg shrink-0"><Icon size={18} className="text-slate-400" /></div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div className={`${card} p-6`}>
          <h3 className={cardTitle}>Outreach by Year</h3>
          {yearData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={yearData}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="year" /><YAxis allowDecimals={false} /><Tooltip /><Legend wrapperStyle={{ color: '#94a3b8' }} />
                <Bar dataKey="nightshift" name="Nightshift" fill="#0284c7" /><Bar dataKey="coffee" name="Mission Coffee" fill="#f59e0b" /></BarChart>
            </ResponsiveContainer>
          ) : empty('No outreach data yet')}
        </div>
        <div className={`${card} p-6`}>
          <h3 className={cardTitle}>Monthly Spend &amp; Tax</h3>
          {monthTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={monthTrend}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="month" tick={axis} /><YAxis tick={axis} /><Tooltip /><Legend wrapperStyle={{ color: '#94a3b8' }} />
                <Line type="monotone" dataKey="spent" name="Total spent (incl. tax)" stroke="#e11d48" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="tax" name="Tax portion" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} /></LineChart>
            </ResponsiveContainer>
          ) : empty('No receipt data yet')}
        </div>
        <div className={`${card} p-6`}>
          <h3 className={cardTitle}>Salvage by Item Type (all time)</h3>
          {salvageByType.some(d => d.total > 0) ? (
            <ResponsiveContainer width="100%" height={Math.max(220, salvageByType.length * 34)}>
              <BarChart data={salvageByType} layout="vertical" margin={{ left: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis type="number" tick={axis} /><YAxis type="category" dataKey="type" width={120} tick={{ fontSize: 11, fill: '#94a3b8' }} /><Tooltip />
                <Bar dataKey="total" name="Items" radius={[0, 4, 4, 0]}>{salvageByType.map((d, i) => <Cell key={d.type} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : empty('No salvage data yet')}
        </div>
        <div className={`${card} p-6`}>
          <h3 className={cardTitle}>Donations by Item Type (all time)</h3>
          {donationByType.some(d => d.total > 0) ? (
            <ResponsiveContainer width="100%" height={Math.max(220, donationByType.length * 34)}>
              <BarChart data={donationByType} layout="vertical" margin={{ left: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis type="number" tick={axis} /><YAxis type="category" dataKey="type" width={120} tick={{ fontSize: 11, fill: '#94a3b8' }} /><Tooltip />
                <Bar dataKey="total" name="Items" radius={[0, 4, 4, 0]}>{donationByType.map((d, i) => <Cell key={d.type} fill={PIE_COLORS[(i + 3) % PIE_COLORS.length]} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : empty('No donation data yet')}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className={`${card} p-6`}>
          <h3 className={cardTitle}>Donor Leaderboard (all time)</h3>
          {topDonors.length > 0 ? (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-slate-400 border-b"><th className="py-2 w-10">#</th><th>Donor</th><th className="text-right">Items</th></tr></thead>
              <tbody>
                {topDonors.map((d, i) => (
                  <tr key={d.donor} className="border-b last:border-0">
                    <td className="py-2 text-slate-400">{i + 1}</td>
                    <td className="font-medium text-slate-200">{d.donor}</td>
                    <td className="text-right font-semibold text-pink-600">{d.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : empty('No donation data yet')}
        </div>
        <div className={`${card} p-6`}>
          <h3 className={`${cardTitle} flex items-center gap-2`}><Activity size={18} className="text-slate-400" /> Activity Log</h3>
          {activity.length > 0 ? (
            <ul className="text-sm max-h-80 overflow-y-auto">
              {activity.map((a, i) => (
                <li key={i} className="flex items-center gap-2 py-1.5 border-b border-slate-800 last:border-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${a.dotCls}`} />
                  <span className="text-slate-400 text-xs w-20 shrink-0">{a.date}</span>
                  <span className="truncate text-slate-200">{a.text}</span>
                </li>
              ))}
            </ul>
          ) : <div className="text-slate-400 py-8 text-center text-sm">No activity yet — start logging above.</div>}
        </div>
      </div>
    </div>
  );
}
