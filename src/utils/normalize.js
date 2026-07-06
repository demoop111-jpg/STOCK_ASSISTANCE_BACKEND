export function normalizeCode(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

export function normalizeSearchCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/\(9\.5\s*FT\)/gi, '95FT')
    .replace(/\(8\s*FT\)/gi, '8FT')
    .replace(/[^A-Z0-9]/g, '');
}

export function cleanMobile(value) {
  return String(value || '').replace(/\D/g, '').slice(-10);
}

export function isValidMobile(value) {
  return /^[6-9]\d{9}$/.test(cleanMobile(value));
}
