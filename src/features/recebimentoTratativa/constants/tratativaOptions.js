export const TRATATIVA_STATUS = {
  ABERTA: 'ABERTA',
  EM_ANDAMENTO: 'EM ANDAMENTO',
  AGUARDANDO: 'AGUARDANDO',
  ENCERRADA: 'ENCERRADA',
  CANCELADA: 'CANCELADA',
};

export const STATUS_OPTIONS = [
  { key: TRATATIVA_STATUS.ABERTA, label: 'Aberta', color: '#d97706', background: '#fff4cf' },
  { key: TRATATIVA_STATUS.EM_ANDAMENTO, label: 'Em andamento', color: '#1e7fc5', background: '#dff2ff' },
  { key: TRATATIVA_STATUS.AGUARDANDO, label: 'Aguardando', color: '#6b48e0', background: '#ece5ff' },
  { key: TRATATIVA_STATUS.ENCERRADA, label: 'Encerrada', color: '#059669', background: '#dcfce9' },
  { key: TRATATIVA_STATUS.CANCELADA, label: 'Cancelada', color: '#dc2626', background: '#fee2e2' },
];

export const ACTION_OPTIONS = [
  { key: 'devolucao', label: 'Devolucao', icon: 'assignment-return', color: '#dc2626' },
  { key: 'troca', label: 'Troca', icon: 'swap-horiz', color: '#2563eb' },
  { key: 'tratativa', label: 'Tratativa', icon: 'build', color: '#0f766e' },
  { key: 'descarte', label: 'Descarte', icon: 'delete-outline', color: '#7c3aed' },
];

export const OCCURRENCE_OPTIONS = [
  { key: 'avaria', label: 'Avaria', icon: 'report-problem', color: '#dc2626' },
  { key: 'falta', label: 'Falta', icon: 'remove-shopping-cart', color: '#d97706' },
  { key: 'outro', label: 'Outro', icon: 'fact-check', color: '#475467' },
];

export const REASON_OPTIONS = [
  'Mercadoria avariada no recebimento',
  'Produto melado',
  'Embalagem rasgada',
  'Caixa amassada',
  'Lacre violado',
  'Falta no recebimento',
  'Divergencia de quantidade',
  'Divergencia entre pedido e entrega',
  'Produto vencido ou fora do padrao',
  'Outro',
];

export const TRATATIVA_TIMELINE_STEPS = [
  { key: 'opened_at', label: 'Abertura' },
  { key: 'started_at', label: 'Início da tratativa' },
  { key: 'expected_end_at', label: 'Previsão de conclusão' },
  { key: 'closed_at', label: 'Encerramento' },
];

export const TRATATIVA_THEME = {
  primary: '#c2410c',
  primaryDark: '#9a3412',
  accent: '#ea580c',
  secondary: '#21405f',
  background: '#f4f6fb',
  backgroundDark: '#1f2438',
  card: '#ffffff',
  cardDark: '#262d47',
  text: '#25324b',
  textDark: '#f3f5ff',
  textMuted: '#667085',
  textMutedDark: '#aab1cf',
  border: '#e5ebf3',
  borderDark: '#3a4265',
  shadow: 'rgba(16, 24, 40, 0.08)',
  white: '#ffffff',
  danger: '#dc2626',
  success: '#059669',
};

export const getStatusMeta = (status) =>
  STATUS_OPTIONS.find((item) => item.key === status) || STATUS_OPTIONS[0];

export const getActionMeta = (action) =>
  ACTION_OPTIONS.find((item) => item.key === action) || ACTION_OPTIONS[0];

export const getOccurrenceMeta = (occurrence) =>
  OCCURRENCE_OPTIONS.find((item) => item.key === occurrence) || OCCURRENCE_OPTIONS[0];

export const normalizeSelectionValues = (...sources) => {
  const values = sources.flatMap((source) => {
    if (Array.isArray(source)) {
      return source;
    }

    if (typeof source === 'string') {
      const trimmed = source.trim();
      return trimmed ? [trimmed] : [];
    }

    return [];
  });

  return [...new Set(values.map((item) => String(item || '').trim()).filter(Boolean))];
};

export const joinSelectionValues = (values, separator = ', ') =>
  normalizeSelectionValues(values).join(separator);

export const formatSelectionSummary = (values, options = {}) => {
  const { emptyLabel = 'Nao informado', maxItems = 2 } = options;
  const normalized = normalizeSelectionValues(values);

  if (normalized.length === 0) {
    return emptyLabel;
  }

  const visible = normalized.slice(0, maxItems).join(', ');
  return normalized.length > maxItems
    ? `${visible} +${normalized.length - maxItems}`
    : visible;
};

export const hasOtherSelection = (values) =>
  normalizeSelectionValues(values).some((item) => item.toLowerCase() === 'outro');

export const formatDateForInput = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

export const formatDatePt = (value) => {
  if (!value) return '—';
  if (typeof value === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    return value;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('pt-BR');
};

export const formatDateTimePt = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return `${parsed.toLocaleDateString('pt-BR')} ${parsed.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};

export const deriveProgress = (caseItem) => {
  if (!caseItem) return 0;

  const openedAt = caseItem.opened_at ? new Date(caseItem.opened_at) : null;
  const startedAt = caseItem.started_at ? new Date(caseItem.started_at) : null;
  const expectedEndAt = caseItem.expected_end_at ? new Date(caseItem.expected_end_at) : null;
  const closedAt = caseItem.closed_at ? new Date(caseItem.closed_at) : null;

  if (caseItem.status === TRATATIVA_STATUS.CANCELADA) {
    return 0;
  }

  if (caseItem.status === TRATATIVA_STATUS.ENCERRADA || closedAt) {
    return 100;
  }

  if (startedAt && expectedEndAt && !Number.isNaN(startedAt.getTime()) && !Number.isNaN(expectedEndAt.getTime())) {
    const total = expectedEndAt.getTime() - startedAt.getTime();
    const elapsed = Date.now() - startedAt.getTime();
    if (total > 0) {
      return Math.min(95, Math.max(5, Math.round((elapsed / total) * 100)));
    }
    return 50;
  }

  if (startedAt && !Number.isNaN(startedAt.getTime())) {
    return 30;
  }

  if (openedAt && !Number.isNaN(openedAt.getTime())) {
    return 10;
  }

  return 0;
};
