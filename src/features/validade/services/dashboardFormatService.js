const DAY_MS = 24 * 60 * 60 * 1000;

export const PDF_A4_LANDSCAPE = {
  label: 'A4 (paisagem)',
  cssSize: 'A4 landscape',
  width: 842,
  height: 595,
};

const startOfDay = (date) => {
  const safe = new Date(date);
  safe.setHours(0, 0, 0, 0);
  return safe;
};

export const parseDateInput = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string' && value.includes('/')) {
    const [day, month, year] = value.split('/').map(Number);
    if (!day || !month || !year) return null;
    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getDaysFromToday = (value) => {
  const target = parseDateInput(value);
  if (!target) return null;
  return Math.round((startOfDay(target) - startOfDay(new Date())) / DAY_MS);
};

export const getDaysAgo = (value) => {
  const target = parseDateInput(value);
  if (!target) return null;
  return Math.max(0, Math.round((startOfDay(new Date()) - startOfDay(target)) / DAY_MS));
};

export const formatDatePt = (value) => {
  const parsed = parseDateInput(value);
  return parsed ? parsed.toLocaleDateString('pt-BR') : '-';
};

export const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const escapeCsvField = (value) => {
  const raw = String(value ?? '');
  if (/[";\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
};

export const toCsv = (rows) => {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(';')];

  rows.forEach((row) => {
    const line = headers.map((header) => escapeCsvField(row[header])).join(';');
    lines.push(line);
  });

  return lines.join('\n');
};
