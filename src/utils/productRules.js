import { normalizeSearchCode } from './normalize.js';

export const PRODUCT_CATEGORIES = [
  {
    id: 'louvers',
    label: 'Louvers',
    companyName: 'Orange Profile',
    categoryName: 'Louvers',
    hasBatches: true
  },
  {
    id: 'paintable',
    label: 'Paintable',
    companyName: 'Orange Profile',
    categoryName: 'Paintable',
    hasBatches: false
  },
  {
    id: 'asa_sheet',
    label: 'ASA Sheet',
    companyName: 'Orange Profile',
    categoryName: 'ASA Sheet',
    hasBatches: false
  },
  {
    id: 'laminate_sheet',
    label: 'Laminate Sheet',
    companyName: 'Best Moulding',
    categoryName: 'Laminate Sheet',
    hasBatches: false
  },
  {
    id: 'acrylic_sheet',
    label: 'Acrylic Sheet',
    companyName: 'Best Moulding',
    categoryName: 'Acrylic Sheet',
    hasBatches: false
  }
];

export function getCategoryById(id = '') {
  return PRODUCT_CATEGORIES.find((category) => category.id === id) || null;
}

export function getCategoryByName(categoryName = '') {
  const key = String(categoryName || '').trim().toUpperCase();
  return PRODUCT_CATEGORIES.find((category) => category.categoryName.toUpperCase() === key) || null;
}

export function isBatchAllowed(item = {}) {
  const category = getCategoryByName(item.categoryName);
  return Boolean(category?.hasBatches);
}

function compactCode(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

export function displayItemCode(productCode = '', categoryName = '') {
  const raw = compactCode(productCode);
  const cat = String(categoryName || '').trim().toUpperCase();

  if (!raw) return '';


  if (cat === 'LOUVERS') {
    const match =
      raw.match(/^(ON\d{2}\s*[- ]\s*[A-Z]+\s*[- ]\s*\d+(?:\s*[- ]\s*\d+)*)/i) ||
      raw.match(/^(LS\d{2}\s*[- ]\s*[A-Z]+\s*[- ]\s*\d+(?:\s*[- ]\s*\d+)*)/i) ||
      raw.match(/^(H\d{2}\s*[- ]\s*[A-Z]+\s*[- ]\s*\d+(?:\s*[- ]\s*\d+)*)/i) ||
      raw.match(/^(L\d{2}\s*[- ]\s*[A-Z]+\s*[- ]\s*\d+(?:\s*[- ]\s*\d+)*)/i) ||
      raw.match(/^(\d{4})/);

    return match ? match[1].replace(/\s*[- ]\s*/g, '-') : raw.split(' ')[0];
  }

  if (cat === 'ASA SHEET') {
    const match = raw.match(/^(OSAG\s*[- ]?\s*\d+)/i) || raw.match(/^(OSAM\s*[- ]?\s*\d+)/i);
    return match ? match[1].replace(/\s*[- ]?\s*/g, '').replace(/^(OSAG|OSAM)(\d+)$/i, '$1-$2') : raw.split(' ')[0];
  }

  if (cat === 'ACRYLIC SHEET') {
    const match = raw.match(/^(DM\s*[- ]?\s*\d+)/i)
      || raw.match(/^(ML\s*[- ]?\s*\d+)/i)
      || raw.match(/^(NM\s*[- ]?\s*\d+)/i)
      || raw.match(/^(SP\s*[- ]?\s*\d+)/i)
      || raw.match(/^(D\s*[- ]?\s*\d+)/i)
      || raw.match(/^(G\s*[- ]?\s*\d+)/i);
    return match ? match[1].replace(/\s*[- ]?\s*/g, '').replace(/^([A-Z]+)(\d+)$/i, '$1-$2') : raw.split(' ')[0];
  }

  if (cat === 'LAMINATE SHEET') {
    const match = raw.match(/^(HGL\s*[- ]?\s*\d+)/i)
      || raw.match(/^(PST\s*[- ]?\s*\d+)/i)
      || raw.match(/^(SF\s*[- ]?\s*\d+)/i)
      || raw.match(/^(TX\s*[- ]?\s*\d+)/i);
    return match ? match[1].replace(/\s*[- ]?\s*/g, '').replace(/^([A-Z]+)(\d+)$/i, '$1-$2') : raw.split(' ')[0];
  }

  if (cat === 'PAINTABLE') {
    const match = raw.match(/^(W\s*[- ]?\s*\d+)/i) || raw.match(/^([A-Z]+\s*[- ]?\s*\d+)/i);
    return match ? match[1].replace(/\s*[- ]?\s*/g, '').replace(/^([A-Z]+)(\d+)$/i, '$1-$2') : raw.split(' ')[0];
  }

  return raw.split(' ')[0];
}

export function itemGroupKey(productCode = '', categoryName = '') {
  const display = displayItemCode(productCode, categoryName);
  const normalized = normalizeSearchCode(display);
  const cat = String(categoryName || '').trim().toUpperCase();

  if (cat === 'LOUVERS') {
    const match = display.match(/^(ON\d{2}|LS\d{2}|H\d{2}|L\d{2}|\d{4})/i);
    return match ? match[1].toUpperCase() : 'OTHER';
  }
  if (cat === 'ASA SHEET') {
    if (normalized.startsWith('OSAG')) return 'OSAG';
    if (normalized.startsWith('OSAM')) return 'OSAM';
    return 'OTHER';
  }

  if (cat === 'ACRYLIC SHEET') {
    if (normalized.startsWith('DM')) return 'DM';
    if (normalized.startsWith('ML')) return 'ML';
    if (normalized.startsWith('NM')) return 'NM';
    if (normalized.startsWith('SP')) return 'SP';
    if (normalized.startsWith('D')) return 'D';
    if (normalized.startsWith('G')) return 'G';
    return 'OTHER';
  }

  if (cat === 'LAMINATE SHEET') {
    for (const prefix of ['HGL', 'PST', 'SF', 'TX']) {
      if (normalized.startsWith(prefix)) return prefix;
    }
    return 'OTHER';
  }

  if (cat === 'PAINTABLE') {
    const match = display.match(/^([A-Z]+)/i);
    return match ? match[1].toUpperCase() : 'OTHER';
  }

  return 'OTHER';
}

export function itemMatchesSearch(item = {}, search = '') {
  const query = normalizeSearchCode(search);
  if (!query) return true;

  const display = displayItemCode(item.productCode, item.categoryName);
  const candidates = [
    item.productCode,
    item.normalizedCode,
    item.tallyStockName,
    display
  ].filter(Boolean).map(normalizeSearchCode);

  return candidates.some((candidate) => candidate === query || candidate.startsWith(query) || candidate.includes(query));
}

export function stockItemPayload(item = {}) {
  const displayCode = displayItemCode(item.productCode, item.categoryName);
  const category = getCategoryByName(item.categoryName);

  return {
    id: String(item._id || ''),
    companyName: item.companyName || '',
    categoryName: item.categoryName || '',
    godownName: item.godownName || '',
    productCode: item.productCode,
    displayCode,
    groupKey: itemGroupKey(item.productCode, item.categoryName),
    normalizedCode: item.normalizedCode,
    tallyStockName: item.tallyStockName || item.productCode,
    available: Number(item.stockQty || 0) > 0,
    stockQty: Number(item.stockQty || 0),
    stockUnit: item.stockUnit || 'Nos.',
    quantityText: item.quantityText || `${Number(item.stockQty || 0)} ${item.stockUnit || 'Nos.'}`,
    stockStatus: item.stockStatus || 'Out of Stock',
    hasBatches: Boolean(category?.hasBatches),
    lastSyncAt: item.lastSyncAt
  };
}
