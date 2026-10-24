import { toISO, isTaxLineItem } from './core';

// ---------- Receipt OCR + parsing ----------
export async function runOCR(imageDataUrl, onProgress) {
  const mod = await import('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/+esm');
  const Tesseract = mod.default || mod;
  const result = await Tesseract.recognize(imageDataUrl, 'eng', {
    logger: m => { if (onProgress && m.status === 'recognizing text') onProgress(Math.round(m.progress * 100)); },
  });
  return result.data.text || '';
}

export function parseReceiptText(text) {
  const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean);
  // Store: first non-numeric substantial line
  let store = '';
  for (const l of rawLines) {
    if (l.length >= 3 && !/^\d/.test(l) && !/^(receipt|invoice|order|cashier|customer)/i.test(l)) {
      store = l.replace(/[^a-zA-Z0-9 &'\-.]/g, '').trim();
      if (store) break;
    }
  }
  // Date — try several patterns
  let date = '';
  const dateCandidates = [
    /(\d{4}-\d{2}-\d{2})/,
    /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
    /(\d{1,2}-\d{1,2}-\d{2,4})/,
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{2,4})/i,
  ];
  for (const re of dateCandidates) {
    const m = text.match(re);
    if (m) {
      const parsed = new Date(m[1]);
      if (!isNaN(parsed.getTime())) { date = toISO(parsed); break; }
    }
  }
  // Tax — its own thing, never a line item. Lines like "TAX 1.24",
  // "SALES TAX 8.99", "WA STATE TAX: 0.27".
  let tax = null;
  const taxRegex = /tax(?:es)?\b[^0-9]*\$?(\d{1,5}\.\d{2})\s*$/i;
  for (const line of rawLines) {
    const tm = line.replace(/[|:]/g, ' ').match(taxRegex);
    if (tm) { tax = tm[1]; break; }
  }
  // Items — line ends with price
  const skipRegex = /^(sub[\s-]?total|total|tax|change|cash|credit|debit|visa|mastercard|amex|balance|tender|amount\s*(due|paid)?|payment|tip|discount|savings|rounding|auth|approved)\b/i;
  const priceRegex = /^(.+?)\s+\$?-?(\d{1,5}\.\d{2})\s*$/;
  const items = [];
  for (const line of rawLines) {
    const m = line.match(priceRegex);
    if (!m) continue;
    const name = m[1].replace(/\s{2,}/g, ' ').trim();
    const cost = Number(m[2]);
    if (!name || cost <= 0) continue;
    if (skipRegex.test(name)) continue;
    if (/\btax(?:es)?\b/i.test(name)) continue; // any tax-like line is never an item
    if (name.length < 2) continue;
    items.push({ name, cost: String(cost.toFixed(2)), category: guessCategory(name) });
  }
  return { store, date, items, tax };
}

export function guessCategory(name) {
  const n = name.toLowerCase();
  // Outreach coffee supplies — the only food bought for outreach runs.
  if (/\b(coffee|caffe|k\-?cups?|decaf|brew|creamer|sugar|\bcups?\b|\blids?\b|stirr?ers?|straws?|filters?|carafe|thermos)\b/.test(n)) return 'Food — Coffee Supplies';
  // Everything else edible is usually for the crew.
  if (/\b(donut|bagel|sandwich|burger|pizza|food|meal|combo|snack|chips?|soda|drinks?|power\s?ade|gatorade|water|milk|bread|breakfast|lunch|dinner|taco|burrito|cookie|pastry|fruit|apple|banana|orange)\b/.test(n)) return 'Food — Employee/Volunteer';
  if (/\b(detergent|soap|bleach|cleaner|wipes|spray|disinfect|mop|broom|sponge|trash|bag)\b/.test(n)) return 'Cleaning Supplies';
  if (/\b(laundry|wash|dryer|fabric|softener)\b/.test(n)) return 'Laundry';
  if (/\b(gas|fuel|diesel|unleaded|parking|toll)\b/.test(n)) return 'Fuel/Transportation';
  if (/\b(oil|tire|brake|filter|wiper|battery)\b/.test(n)) return 'Vehicle Maintenance';
  if (/\b(pen|paper|binder|folder|stapler|tape|marker|ink|print)\b/.test(n)) return 'Office Supplies';
  if (/\b(blanket|coat|hoodie|jacket|sock|glove|hat|boot|shoe|pant|shirt)\b/.test(n)) return 'Blankets/Clothing Purchase';
  if (/\b(electric|water bill|power|utility|internet|phone)\b/.test(n)) return 'Utilities';
  return 'Other';
}

// Build normalized item catalogue across all receipts
export function buildItemCatalogue(receipts) {
  const map = {};
  receipts.forEach(r => {
    (r.items || []).forEach(it => {
      if (isTaxLineItem(it)) return; // tax is not a purchased item
      const key = (it.name || '').toLowerCase().trim();
      if (!key) return;
      if (!map[key]) map[key] = { key, name: it.name, purchases: [], totalSpent: 0, count: 0, categories: new Set(), stores: new Set() };
      map[key].purchases.push({ receiptId: r.id, date: r.date, store: r.store, cost: Number(it.cost) || 0, category: it.category });
      map[key].totalSpent += Number(it.cost) || 0;
      map[key].count += 1;
      if (it.category) map[key].categories.add(it.category);
      if (r.store) map[key].stores.add(r.store);
    });
  });
  return Object.values(map).map(v => ({
    ...v,
    categories: Array.from(v.categories),
    stores: Array.from(v.stores),
    avgCost: v.count > 0 ? v.totalSpent / v.count : 0,
    firstDate: v.purchases.slice().sort((a, b) => a.date.localeCompare(b.date))[0]?.date || '',
    lastDate: v.purchases.slice().sort((a, b) => b.date.localeCompare(a.date))[0]?.date || '',
  })).sort((a, b) => b.count - a.count);
}
