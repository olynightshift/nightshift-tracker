import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity } from 'lucide-react';
import { groupOutreachByMonth, receiptTotal, sumQuantitiesAllTime } from '../lib/core';

// ============================================================
// Dashboard
// ============================================================
export function Dashboard({ outreach, salvage, closet, receipts, donations, salvageItemTypes, donors }) {
  const currentYear = new Date().getFullYear();
  const totalNightshift = outreach.filter(e => e.nightshift).length;
  const totalCoffee = outreach.filter(e => e.coffee).length;
  const totalSalvageItems = Object.values(sumQuantitiesAllTime(salvage, salvageItemTypes)).reduce((s, v) => s + v, 0);
  const totalPeople = closet.reduce((s, e) => s + e.people, 0);
  const totalSpent = receipts.reduce((s, r) => s + receiptTotal(r), 0);
  const totalDonatedItems = donations.reduce((s, e) => s + Object.values(e.quantities).reduce((ss, v) => ss + (Number(v) || 0), 0), 0);
  const stats = [
    { label: 'Nightshift Days', value: totalNightshift, color: 'bg-blue-500' },
    { label: 'Coffee Days', value: totalCoffee, color: 'bg-amber-500' },
    { label: 'Salvage Items', value: totalSalvageItems, color: 'bg-purple-500' },
    { label: 'People Served', value: totalPeople, color: 'bg-pink-500' },
    { label: 'Items Donated', value: totalDonatedItems, color: 'bg-emerald-500' },
    { label: 'Donors', value: donors.length, color: 'bg-cyan-500' },
    { label: 'Receipts', value: receipts.length, color: 'bg-indigo-500' },
    { label: 'Total Spent', value: '$' + totalSpent.toFixed(2), color: 'bg-red-500' },
  ];

  const yearData = groupOutreachByMonth(outreach, currentYear);
  const monthMap = {};
  receipts.forEach(r => { const key = r.date.slice(0, 7); monthMap[key] = (monthMap[key] || 0) + receiptTotal(r); });
  const monthTrend = Object.entries(monthMap).sort((a, b) => a[0].localeCompare(b[0])).map(([month, total]) => ({ month, total }));

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
      dotCls: 'bg-blue-500',
      text: [e.nightshift && 'Nightshift outreach', e.coffee && 'Mission Coffee'].filter(Boolean).join(' + '),
    })),
    ...closet.map(e => ({ date: e.date, dotCls: 'bg-pink-500', text: `${e.people} people served at the closet` })),
    ...salvage.map(e => ({
      date: e.date, dotCls: 'bg-purple-500',
      text: `${Object.values(e.quantities || {}).reduce((s, v) => s + (Number(v) || 0), 0)} salvage items from ${donorName(e.donor_id)}`,
    })),
    ...donations.map(e => ({
      date: e.date, dotCls: 'bg-emerald-500',
      text: `${Object.values(e.quantities || {}).reduce((s, v) => s + (Number(v) || 0), 0)} items donated by ${donorName(e.donor_id)}`,
    })),
    ...receipts.map(r => ({ date: r.date, dotCls: 'bg-indigo-500', text: `Receipt: $${receiptTotal(r).toFixed(2)} at ${r.store}` })),
  ].sort((a, b) => b.date.localeCompare(a.date) || (b.text > a.text ? 1 : -1)).slice(0, 12);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-lg shadow p-3">
            <div className={`w-2 h-2 rounded-full ${s.color} mb-2`} />
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-medium mb-2">Outreach — {currentYear}</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={yearData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Legend />
              <Bar dataKey="nightshift" name="Nightshift" fill="#3b82f6" /><Bar dataKey="coffee" name="Mission Coffee" fill="#f59e0b" /></BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-medium mb-2">Monthly Spend</h3>
          {monthTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={monthTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip />
                <Line type="monotone" dataKey="total" stroke="#ef4444" strokeWidth={2} /></LineChart>
            </ResponsiveContainer>
          ) : <div className="text-gray-400 py-8 text-center text-sm h-[240px] flex items-center justify-center">No receipt data yet</div>}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-medium mb-2">Top Donors (all time)</h3>
          {topDonors.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topDonors} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="donor" width={110} /><Tooltip />
                <Bar dataKey="total" fill="#06b6d4" /></BarChart>
            </ResponsiveContainer>
          ) : <div className="text-gray-400 py-8 text-center text-sm">No donation data yet</div>}
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-medium mb-2 flex items-center gap-2"><Activity size={16} /> Recent Activity</h3>
          {activity.length > 0 ? (
            <ul className="text-sm">
              {activity.map((a, i) => (
                <li key={i} className="flex items-center gap-2 py-1.5 border-b last:border-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${a.dotCls}`} />
                  <span className="text-gray-500 text-xs w-20 shrink-0">{a.date}</span>
                  <span className="truncate">{a.text}</span>
                </li>
              ))}
            </ul>
          ) : <div className="text-gray-400 py-8 text-center text-sm">No activity yet — start logging above.</div>}
        </div>
      </div>
    </div>
  );
}
