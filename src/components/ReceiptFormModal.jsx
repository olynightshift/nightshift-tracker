import { useState } from 'react';
import { Receipt as ReceiptIcon, Camera, ScanLine, X, Trash2, Plus, Save } from 'lucide-react';
import { api } from '../api';
import { RECEIPT_CATEGORIES, todayISO, isTaxLineItem } from '../lib/core';
import { runOCR, parseReceiptText } from '../lib/receipts';
import { Modal } from './ui';
import { useToast } from './toast-context';
import { useUndo } from './undo-context';

// ============================================================
// Receipt Form Modal (used for add + edit, supports OCR)
// ============================================================
export function ReceiptFormModal({ receipt, setReceipts, onClose, onSaved }) {
  const isEdit = !!receipt?.id;
  const [date, setDate] = useState(receipt?.date || todayISO);
  const [store, setStore] = useState(receipt?.store || '');
  const [items, setItems] = useState(receipt?.items ? receipt.items.map(it => ({ ...it, cost: String(it.cost) })) : [{ name: '', cost: '', category: 'Other' }]);
  const [tax, setTax] = useState(receipt?.tax ? String(receipt.tax) : '');
  const [image, setImage] = useState(receipt?.image || null);
  const [saving, setSaving] = useState(false);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrText, setOcrText] = useState('');
  const [showOcrText, setShowOcrText] = useState(false);
  const toast = useToast();
  const { runAction } = useUndo();

  function updateItem(i, field, value) { setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it)); }
  function addItemRow() { setItems(prev => [...prev, { name: '', cost: '', category: 'Other' }]); }
  function removeItemRow(i) { setItems(prev => prev.filter((_, idx) => idx !== i)); }

  function handleImage(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result);
    reader.readAsDataURL(file);
  }

  async function doOCR() {
    if (!image) { toast('Attach a photo first.', 'error'); return; }
    setOcrRunning(true); setOcrProgress(0);
    try {
      const text = await runOCR(image, p => setOcrProgress(p));
      setOcrText(text);
      const parsed = parseReceiptText(text);
      if (parsed.store && !store) setStore(parsed.store);
      if (parsed.date) setDate(parsed.date);
      if (parsed.items.length > 0) {
        const nonEmpty = items.filter(it => it.name || it.cost);
        setItems([...nonEmpty, ...parsed.items]);
        toast(`Parsed ${parsed.items.length} item${parsed.items.length === 1 ? '' : 's'} from photo — please review.`, 'success');
      } else {
        toast('OCR finished but no items were parsed. Check the raw text — you can still add items manually.', 'info');
      }
      if (parsed.tax != null) setTax(parsed.tax);
    } catch (err) {
      toast('OCR failed: ' + (err.message || err), 'error');
    } finally {
      setOcrRunning(false);
    }
  }

  async function save() {
    if (!store.trim()) { toast('Enter a store name.', 'error'); return; }
    // Tax-named lines fold into the tax field — they are never purchased items.
    const taxLinesTotal = items.reduce((s, it) => s + (isTaxLineItem(it) ? (Number(it.cost) || 0) : 0), 0);
    const cleanItems = items.filter(it => ((it.name || '').trim() || Number(it.cost) > 0) && !isTaxLineItem(it))
      .map(it => ({ name: (it.name || '').trim(), cost: Number(it.cost) || 0, category: it.category || 'Other' }));
    if (cleanItems.length === 0 && !(Number(tax) > 0)) { toast('Add at least one item.', 'error'); return; }
    const totalTax = (Number(tax) || 0) + taxLinesTotal;
    setSaving(true);
    const row = { date, store: store.trim(), image, tax: totalTax, items: cleanItems };
    let createdId = null;
    const ok = await runAction({
      label: isEdit ? 'Update receipt' : 'Save receipt',
      doFn: async () => {
        if (isEdit) { await api.receipts.update({ ...row, id: receipt.id }); onSaved({ ...row, id: receipt.id }); }
        else { createdId = await api.receipts.insert(row); onSaved({ ...row, id: createdId }); }
      },
      undoFn: async () => {
        if (!setReceipts) return;
        if (isEdit) {
          await api.receipts.update(receipt);
          setReceipts(prev => prev.map(x => x.id === receipt.id ? receipt : x));
        } else if (createdId != null) {
          await api.receipts.remove({ id: createdId });
          setReceipts(prev => prev.filter(x => x.id !== createdId));
        }
      },
    });
    setSaving(false);
    if (ok) { toast(isEdit ? 'Receipt updated.' : 'Receipt saved.', 'success'); onClose(); }
  }

  const subtotal = items.reduce((s, it) => s + (isTaxLineItem(it) ? 0 : (Number(it.cost) || 0)), 0);
  const foldedTax = items.reduce((s, it) => s + (isTaxLineItem(it) ? (Number(it.cost) || 0) : 0), 0);
  const totalCost = subtotal + (Number(tax) || 0) + foldedTax;

  return (
    <Modal onClose={onClose} maxWidth="max-w-3xl">
      <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
        <h2 className="text-lg font-semibold flex items-center gap-2"><ReceiptIcon size={20} /> {isEdit ? 'Edit Receipt' : 'Add Receipt'}</h2>
        <button onClick={onClose}><X size={20} /></button>
      </div>
      <div className="p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div><label className="block text-sm text-gray-600 mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border rounded px-2 py-1" /></div>
          <div className="flex-1 min-w-48"><label className="block text-sm text-gray-600 mb-1">Store / Vendor</label>
            <input type="text" value={store} onChange={e => setStore(e.target.value)} placeholder="e.g. Costco" className="border rounded px-2 py-1 w-full" /></div>
        </div>

        <div className="border rounded p-3 bg-gray-50">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-1 cursor-pointer bg-white border rounded px-3 py-1.5 text-sm hover:bg-gray-50">
              <Camera size={14} /> {image ? 'Replace Photo' : 'Attach Photo'}
              <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
            </label>
            {image && (
              <button onClick={doOCR} disabled={ocrRunning} className="bg-indigo-600 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1 disabled:opacity-50">
                <ScanLine size={14} />{ocrRunning ? `Reading… ${ocrProgress}%` : 'Scan Receipt (OCR)'}
              </button>
            )}
            {image && <img src={image} alt="receipt" className="h-20 rounded border" />}
            {ocrText && <button onClick={() => setShowOcrText(s => !s)} className="text-xs text-blue-600 underline">{showOcrText ? 'Hide' : 'Show'} raw text</button>}
          </div>
          {showOcrText && <pre className="text-xs mt-2 bg-white border p-2 rounded max-h-40 overflow-auto whitespace-pre-wrap">{ocrText}</pre>}
          <div className="text-xs text-gray-500 mt-2">Tip: OCR is best with a clear, well-lit photo. You can edit anything it misreads.</div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="font-medium text-sm">Items</div>
          {items.map((it, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input type="text" placeholder="Item name" value={it.name} onChange={e => updateItem(i, 'name', e.target.value)} className="border rounded px-2 py-1 flex-1 min-w-32" />
              <input type="number" step="0.01" placeholder="Cost" value={it.cost} onChange={e => updateItem(i, 'cost', e.target.value)} className="border rounded px-2 py-1 w-24" />
              <select value={it.category} onChange={e => updateItem(i, 'category', e.target.value)} className="border rounded px-2 py-1 text-sm">
                {RECEIPT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button onClick={() => removeItemRow(i)} title="Remove"><Trash2 size={16} className="text-red-500" /></button>
            </div>
          ))}
          <button onClick={addItemRow} className="text-sm text-blue-600 flex items-center gap-1 w-fit"><Plus size={14} />Add Item</button>
          <div className="text-xs text-slate-400 -mt-1">Tip: tax lines are folded into the Tax field automatically — no need to enter them as items.</div>
        </div>

        <div className="flex flex-wrap items-end gap-3 border rounded p-3 bg-amber-50/50 border-amber-200">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Tax</label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-500">$</span>
              <input type="number" step="0.01" min="0" placeholder="0.00" value={tax} onChange={e => setTax(e.target.value)} className="border rounded px-2 py-1 w-28" />
            </div>
          </div>
          <div className="text-xs text-amber-700 pb-1">Sales tax for this receipt, kept separate from spending categories. OCR fills this in when it can read it.</div>
        </div>

        <div className="text-right text-sm space-y-0.5">
          <div className="text-gray-500">Items subtotal: ${subtotal.toFixed(2)}</div>
          <div className="text-amber-600">Tax: ${((Number(tax) || 0) + foldedTax).toFixed(2)}</div>
          <div className="font-medium">Total: ${totalCost.toFixed(2)}</div>
        </div>
      </div>
      <div className="flex justify-end gap-2 p-4 border-t bg-gray-50 sticky bottom-0">
        <button onClick={onClose} className="px-4 py-1.5 rounded border bg-white">Cancel</button>
        <button onClick={save} disabled={saving} className="px-4 py-1.5 rounded bg-indigo-600 text-white disabled:opacity-50 flex items-center gap-1">
          <Save size={14} />{saving ? 'Saving…' : (isEdit ? 'Update Receipt' : 'Save Receipt')}
        </button>
      </div>
    </Modal>
  );
}
