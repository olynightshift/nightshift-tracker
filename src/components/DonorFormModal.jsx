import { useState } from 'react';
import { Users, Mail, Phone, MapPin, X } from 'lucide-react';
import { api } from '../api';
import { Modal } from './ui';
import { useToast } from './toast-context';

// ============================================================
// Donor Contact Form Modal
// ============================================================
export function DonorFormModal({ donor, onClose, onSaved }) {
  const [name, setName] = useState(donor?.name || '');
  const [organization, setOrganization] = useState(donor?.organization || '');
  const [email, setEmail] = useState(donor?.email || '');
  const [phone, setPhone] = useState(donor?.phone || '');
  const [address, setAddress] = useState(donor?.address || '');
  const [notes, setNotes] = useState(donor?.notes || '');
  const [saving, setSaving] = useState(false);
  const isEdit = !!donor?.id;
  const toast = useToast();

  async function handleSave() {
    if (!name.trim()) { toast('Donor name is required.', 'error'); return; }
    setSaving(true);
    try {
      const row = { id: donor?.id, name: name.trim(), organization, email, phone, address, notes };
      if (isEdit) { await api.donors.update(row); onSaved(row); }
      else { const id = await api.donors.insert(row); onSaved({ ...row, id }); }
      toast(isEdit ? 'Contact updated.' : 'Contact saved.', 'success');
      onClose();
    } catch (err) { toast('Save failed: ' + err.message, 'error'); }
    finally { setSaving(false); }
  }

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold flex items-center gap-2"><Users size={20} /> {isEdit ? 'Edit Donor' : 'Add New Donor'}</h2>
        <button onClick={onClose}><X size={20} /></button>
      </div>
      <div className="p-4 flex flex-col gap-3">
        <div><label className="block text-sm text-gray-600 mb-1">Name <span className="text-red-500">*</span></label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="border rounded px-2 py-1 w-full" autoFocus /></div>
        <div><label className="block text-sm text-gray-600 mb-1">Organization</label>
          <input type="text" value={organization} onChange={e => setOrganization(e.target.value)} className="border rounded px-2 py-1 w-full" /></div>
        <div><label className="block text-sm text-gray-600 mb-1 flex items-center gap-1"><Mail size={14} /> Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="border rounded px-2 py-1 w-full" /></div>
        <div><label className="block text-sm text-gray-600 mb-1 flex items-center gap-1"><Phone size={14} /> Phone</label>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="border rounded px-2 py-1 w-full" /></div>
        <div><label className="block text-sm text-gray-600 mb-1 flex items-center gap-1"><MapPin size={14} /> Address</label>
          <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2} className="border rounded px-2 py-1 w-full" /></div>
        <div><label className="block text-sm text-gray-600 mb-1">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="border rounded px-2 py-1 w-full" /></div>
      </div>
      <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
        <button onClick={onClose} className="px-4 py-1.5 rounded border bg-white">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 rounded bg-emerald-600 text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save Contact'}</button>
      </div>
    </Modal>
  );
}
