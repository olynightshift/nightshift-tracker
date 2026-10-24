import { supabase, TABLES } from './lib/core';

// ---------------- Supabase API ----------------
export const api = {
  outreach: {
    async load() {
      const { data, error } = await supabase.from(TABLES.outreach).select('date, nightshift, coffee');
      if (error) throw error;
      return (data || []).map(r => ({ id: r.date, date: r.date, nightshift: !!r.nightshift, coffee: !!r.coffee }));
    },
    async upsert(row) {
      const { error } = await supabase.from(TABLES.outreach).upsert({ date: row.date, nightshift: !!row.nightshift, coffee: !!row.coffee }, { onConflict: 'date' });
      if (error) throw error;
    },
    async remove(row) {
      const { error } = await supabase.from(TABLES.outreach).delete().eq('date', row.date);
      if (error) throw error;
    },
  },
  salvage: {
    async load() {
      const { data, error } = await supabase.from(TABLES.salvage).select('date, item_type, quantity, donor_id');
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
      let del = supabase.from(TABLES.salvage).delete().eq('date', row.date);
      del = row.donor_id == null ? del.is('donor_id', null) : del.eq('donor_id', row.donor_id);
      const { error: delErr } = await del;
      if (delErr) throw delErr;
      const payload = Object.entries(row.quantities || {}).filter(([, q]) => Number(q) > 0)
        .map(([item_type, quantity]) => ({ date: row.date, item_type, quantity: Number(quantity), donor_id: row.donor_id ?? null }));
      if (payload.length === 0) return;
      const { error } = await supabase.from(TABLES.salvage).insert(payload);
      if (error) throw error;
    },
    async removeEntry(row) {
      let del = supabase.from(TABLES.salvage).delete().eq('date', row.date);
      del = row.donor_id == null ? del.is('donor_id', null) : del.eq('donor_id', row.donor_id);
      const { error } = await del;
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
      const payload = Object.entries(row.quantities || {}).filter(([, q]) => Number(q) > 0)
        .map(([item_type, quantity]) => ({ date: row.date, item_type, quantity: Number(quantity), donor_id: row.donor_id ?? null }));
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
        supabase.from(TABLES.receipts).select('id, date, store, image_url, tax'),
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
      return (receiptsRes.data || []).map(r => ({ id: r.id, date: r.date, store: r.store, image: r.image_url || null, tax: Number(r.tax) || 0, items: itemsByReceipt[r.id] || [] }));
    },
    async insert(row) {
      const { data: rec, error } = await supabase.from(TABLES.receipts).insert({ date: row.date, store: row.store, image_url: row.image || null, tax: Number(row.tax) || 0 }).select('id').single();
      if (error) throw error;
      const items = (row.items || []).map(it => ({ receipt_id: rec.id, item_name: it.name, category: it.category || 'Other', cost: Number(it.cost) || 0 }));
      if (items.length > 0) {
        const { error: itemErr } = await supabase.from(TABLES.receiptItems).insert(items);
        if (itemErr) throw itemErr;
      }
      return rec.id;
    },
    async update(row) {
      const { error } = await supabase.from(TABLES.receipts).update({ date: row.date, store: row.store, image_url: row.image || null, tax: Number(row.tax) || 0 }).eq('id', row.id);
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
