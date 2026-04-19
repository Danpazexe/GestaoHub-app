export const pluralize = (count, singular, plural) => (count === 1 ? singular : plural);

export const normalizeKey = (value) => String(value || '').trim().toUpperCase();

export const computeTotals = (items) => {
  const expected = items.reduce((sum, item) => sum + (Number(item.expectedQty) || 0), 0);
  const checked = items.reduce((sum, item) => sum + (Number(item.checkedQty) || 0), 0);
  const pendingItems = items.filter((item) => (Number(item.checkedQty) || 0) < (Number(item.expectedQty) || 0)).length;
  const divergences = items.filter((item) => (Number(item.checkedQty) || 0) !== (Number(item.expectedQty) || 0)).length;
  return { expected, checked, pendingItems, divergences };
};

export const computeProgress = (totals) => {
  if (!totals?.expected) return 0;
  return Math.min(100, Math.round((totals.checked / totals.expected) * 100));
};

export const clampInt = (value, min, max) => {
  const num = Math.trunc(Number(value));
  if (!Number.isFinite(num)) return min;
  return Math.min(max, Math.max(min, num));
};

export const buildConferenceEvent = ({
  type,
  actor = '',
  payload = {},
  createdAt = new Date().toISOString(),
} = {}) => ({
  id: `conf-event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  type: String(type || 'unknown'),
  actor: String(actor || '').trim(),
  createdAt,
  payload,
});
