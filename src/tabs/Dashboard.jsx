import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, CalendarCheck, Coffee, Weight, Package, Users, Gift, ContactRound, DollarSign } from 'lucide-react';
import { groupOutreachByMonth, receiptTotal, sumQuantitiesAllTime, sumReceiptsByCategory, sumReceiptTax, toISO, addDays, PIE_COLORS } from '../lib/core';

// ============================================================
// Dashboard — stat cards + analytics in the classic style:
// white rounded-xl cards, pastel icon chips, colored values,
// and a grid of chart cards.
// ============================================================
export function Dashboard({ outreach, salvage, closet, receipts, donations, salvageItemTypes, donors }) {
  const currentYear = new Date().getFullYear();
  // Pounds is a weight measurement, not a counted item — track it separately.
  const weightType = salvageItemTypes.find(t => t.toLowerCase() === 'pounds');
  const itemTypes = weightType ? salvageItemTypes.filter(t => t !== weightType) : salvageItemTypes;
  const totalNightshift = outreach.filter(e => e.nightshift).length;
  const totalCoffee = outreach.filter(e => e.coffee).length;
  const totalSalvageItems = Object.values(sumQuantitiesAllTime(salvage, itemTypes)).reduce((s, v) => s + v, 0);
  const totalPounds = weightType ? salvage.reduce((s, e) => s + (Number(e.quantities[weightType]) || 0), 0) : 0;
  const totalPeople = closet.reduce((s, e) => s + e.people, 0);
  const totalSpent = receipts.reduce((s, r) => s + receiptTotal(r), 0);
  const totalDonatedItems = donations.reduce((s, e) => s + Object.values(e.quantities).reduce((ss, v) => ss + (Number(v) || 0), 0), 0);

  const stats = [
    { label: 'Outreach Days', value: totalNightshift, icon: CalendarCheck, chip: 'bg-sky-100', iconCls: 'text-sky-600', valCls: 'text-sky-600' },
    { label: 'Mission Coffee Days', value: totalCoffee, icon: Coffee, chip: 'bg-amber-100', iconCls: 'text-amber-600', valCls: 'text-amber-600' },
    { label: 'Textiles Salvaged', value: `${totalPounds.toLocaleString()} lbs`, icon: Weight, chip: 'bg-emerald-100', iconCls: 'text-emerald-600', valCls: 'text-emerald-600' },
    { label: 'Salvage Items', value: totalSalvageItems.toLocaleString(), icon: Package, chip: 'bg-teal-100', iconCls: 'text-teal-600', valCls: 'text-teal-600' },
    { label: 'People Served', value: totalPeople.toLocaleString(), icon: Users, chip: 'bg-purple-100', iconCls: 'text-purple-600', valCls: 'text-purple-600' },
    { label: 'Items Donated', value: totalDonatedItems.toLocaleString(), icon: Gift, chip: 'bg-pink-100', iconCls: 'text-pink-600', valCls: 'text-pink-600' },
    { label: 'Donor Contacts', value: donors.length, icon: ContactRound, chip: 'bg-indigo-100', iconCls: 'text-indigo-600', valCls: 'text-indigo-600' },
    { label: 'Total Expenses', value: '$' + totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), icon: DollarSign, chip: 'bg-rose-100', iconCls: 'text-rose-600', valCls: 'text-rose-600' },
  ];

  // ---- last-30-days series ----
  const today = new Date();
  const days30 = [];
  for (let i = 29; i >= 0; i--) { const d = addDays(today, -i); days30.push({ iso: toISO(d), label: `${d.getMonth() + 1}/${d.getDate()}` }); }
  const outreachMap = {}; outreach.forEach(e => { outreachMap[e.date] = e; });
  const itemCount = e => Object.entries(e.quantities || {}).reduce((s, [t, v]) => s + (weightType && t === weightType ? 0 : (Number(v) || 0)), 0);
  const outreach30 = days30.map(d => ({ day: d.label, nightshift: outreachMap[d.iso]?.nightshift ? 1 : 0, coffee: outreachMap[d.iso]?.coffee ? 1 : 0 }));
  const salvage30 = days30.map(d => ({ day: d.label, items: salvage.filter(e => e.date === d.iso).reduce((s, e) => s + itemCount(e), 0) }));
  const closet30 = days30.map(d => ({ day: d.label, people: closet.filter(e => e.date === d.iso).reduce((s, e) => s + e.people, 0) }));

  const yearData = groupOutreachByMonth(outreach, currentYear);
  const monthMap = {};
  receipts.forEach(r => { const key = r.date.slice(0, 7); monthMap[key] = (monthMap[key] || 0) + receiptTotal(r); });
  const monthTrend = Object.entries(monthMap).sort((a, b) => a[0].localeCompare(b[0])).map(([month, total]) => ({ month, total }));

  const catData = sumReceiptsByCategory(receipts).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
  const totalTax = sumReceiptTax(receipts);

  const donorTotals = {};
  donations.forEach(e => {
    const key = e.donor_id ?? 'null';
    const total = Object.values(e.quantities || {}).reduce((s, v) => s + (Number(v) || 0), 0);
    donorTotals[key] = (donorTotals[key] || 0) + total;
  });
  const donorMap = {}; donors.forEach(d => { donorMap[d.id] = d; });
  const topDonors = Object.entries(donorTotals)
    .map(([k, v]) => ({ donor: k === 'null' ? 'Anonymous' : (donorMap[Number(k)]?.name || 'Unknown'), total: v }))
    .sort((a, b) => b.total - a.total).slice(0, 5);

  // Recent activity across all modules
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
  ].sort((a, b) => b.date.localeCompare(a.date) || (b.text > a.text ? 1 : -1)).slice(0, 12);

  const card = 'bg-white rounded-xl shadow-sm border border-slate-200';
  const cardTitle = 'text-lg font-semibold text-slate-800 mb-4';
  const empty = (msg) => <div className="text-slate-400 text-sm h-[220px] flex items-center justify-center">{msg}</div>;

  return (
    <div className="fade-in">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Dashboard</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="stat-card bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-slate-500 truncate">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.valCls}`}>{s.value}</p>
                </div>
                <div className={`${s.chip} p-3 rounded-lg shrink-0`}><Icon size={18} className={s.iconCls} /></div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div className={`${card} p-6`}>
          <h3 className={cardTitle}>Outreach Activity (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={outreach30}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="day" tick={{ fontSize: 10 }} interval={4} /><YAxis allowDecimals={false} /><Tooltip /><Legend />
              <Bar dataKey="nightshift" name="Nightshift" fill="#0284c7" /><Bar dataKey="coffee" name="Mission Coffee" fill="#f59e0b" /></BarChart>
          </ResponsiveContainer>
        </div>
        <div className={`${card} p-6`}>
          <h3 className={cardTitle}>Salvage Trends (Last 30 Days)</h3>
          {salvage30.some(d => d.items > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={salvage30}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="day" tick={{ fontSize: 10 }} interval={4} /><YAxis allowDecimals={false} /><Tooltip />
                <Line type="monotone" dataKey="items" name="Items" stroke="#0d9488" strokeWidth={2} dot={false} /></LineChart>
            </ResponsiveContainer>
          ) : empty('No salvage data in the last 30 days')}
        </div>
        <div className={`${card} p-6`}>
          <h3 className={cardTitle}>Clothing Closet Usage (Last 30 Days)</h3>
          {closet30.some(d => d.people > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={closet30}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="day" tick={{ fontSize: 10 }} interval={4} /><YAxis allowDecimals={false} /><Tooltip />
                <Bar dataKey="people" name="People served" fill="#9333ea" /></BarChart>
            </ResponsiveContainer>
          ) : empty('No closet data in the last 30 days')}
        </div>
        <div className={`${card} p-6`}>
          <h3 className={cardTitle}>Expense Breakdown by Category</h3>
          {catData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart><Pie data={catData} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={80} label={(e) => e.category}>
                {catData.map((c, i) => <Cell key={c.category} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie><Tooltip /></PieChart>
            </ResponsiveContainer>
          ) : empty('No receipt data yet')}
          <div className="text-xs text-amber-600 border-t border-amber-100 pt-2 mt-1">
            Sales tax is tracked separately: ${totalTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} all time
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div className={`${card} p-6`}>
          <h3 className={cardTitle}>Outreach — {currentYear}</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={yearData}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Legend />
              <Bar dataKey="nightshift" name="Nightshift" fill="#0284c7" /><Bar dataKey="coffee" name="Mission Coffee" fill="#f59e0b" /></BarChart>
          </ResponsiveContainer>
        </div>
        <div className={`${card} p-6`}>
          <h3 className={cardTitle}>Monthly Spend</h3>
          {monthTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={monthTrend}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="month" /><YAxis /><Tooltip />
                <Line type="monotone" dataKey="total" stroke="#e11d48" strokeWidth={2} dot={{ r: 3 }} /></LineChart>
            </ResponsiveContainer>
          ) : empty('No receipt data yet')}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className={`${card} p-6`}>
          <h3 className={cardTitle}>Top Donors (all time)</h3>
          {topDonors.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topDonors} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis type="number" /><YAxis type="category" dataKey="donor" width={110} /><Tooltip />
                <Bar dataKey="total" fill="#4f46e5" radius={[0, 4, 4, 0]} /></BarChart>
            </ResponsiveContainer>
          ) : empty('No donation data yet')}
        </div>
        <div className={`${card} p-6`}>
          <h3 className={`${cardTitle} flex items-center gap-2`}><Activity size={18} className="text-slate-500" /> Recent Activity</h3>
          {activity.length > 0 ? (
            <ul className="text-sm">
              {activity.map((a, i) => (
                <li key={i} className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${a.dotCls}`} />
                  <span className="text-slate-400 text-xs w-20 shrink-0">{a.date}</span>
                  <span className="truncate text-slate-700">{a.text}</span>
                </li>
              ))}
            </ul>
          ) : <div className="text-slate-400 py-8 text-center text-sm">No activity yet — start logging above.</div>}
        </div>
      </div>
    </div>
  );
}
