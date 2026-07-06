import { normalizeCode } from './normalize.js';

export function getPcsPerBox(productCode) {
  const code = normalizeCode(productCode).replace(/\s+/g, '');

  if (code.startsWith('LS')) return 30;
  if (code.startsWith('H')) return 20;
  if (code.startsWith('L')) return 16;
  if (code.startsWith('80')) return 12;

  return null;
}

export function calculateRequiredPcs(productCode, requestedQty, requestedUnit) {
  const qty = Number(requestedQty);
  const unit = String(requestedUnit || '').toUpperCase();
  const pcsPerBox = getPcsPerBox(productCode);

  if (!Number.isFinite(qty) || qty <= 0) {
    return { error: 'Valid quantity is required' };
  }

  if (!['PCS', 'BOX'].includes(unit)) {
    return { error: 'Unit must be PCS or BOX' };
  }

  if (unit === 'BOX' && !pcsPerBox) {
    return { error: 'Box conversion rule is not available for this item code' };
  }

  const requestedPcs = unit === 'BOX' ? qty * pcsPerBox : qty;
  return { requestedPcs, pcsPerBox, requestedQty: qty, requestedUnit: unit };
}

export function formatAvailableInRequestedUnit(stockQty, productCode, requestedUnit) {
  const qty = Number(stockQty || 0);
  const unit = String(requestedUnit || '').toUpperCase();
  const pcsPerBox = getPcsPerBox(productCode);

  if (unit === 'BOX' && pcsPerBox) {
    const boxes = Math.floor(qty / pcsPerBox);
    const remainingPcs = qty % pcsPerBox;
    if (remainingPcs > 0) return `${boxes} BOX + ${remainingPcs} PCS`;
    return `${boxes} BOX`;
  }

  return `${qty} PCS`;
}

export function buildAvailabilityMessage({ productCode, requestedQty, requestedUnit, available, stockQty, pcsPerBox }) {
  const unit = String(requestedUnit || '').toUpperCase();
  const askedText = `${requestedQty} ${unit}`;
  const availableText = formatAvailableInRequestedUnit(stockQty, productCode, unit);
  const conversionLine = unit === 'BOX' && pcsPerBox ? `\n1 BOX = ${pcsPerBox} PCS` : '';

  if (available) {
    return `Yes, available ✅`;
  }

  // if (available) {
  //   return `Yes, available ✅\n\nItem: ${productCode}\nRequired Qty: ${askedText}\nAvailable Stock: ${availableText}${conversionLine}`;
  // }

  return `Sorry, requested quantity is not available right now.`;
  // return `Sorry, requested quantity is not available right now.\n\nItem: ${productCode}\nRequired Qty: ${askedText}\nAvailable Stock: ${availableText}${conversionLine}`;
}
