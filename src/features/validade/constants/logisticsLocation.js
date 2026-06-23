export const LOGISTICS_LOCATION_FIELDS = [
  {
    key: 'corredor',
    label: 'Corredor',
    cardLabel: 'Corredor',
    shortLabel: 'Corredor',
    compactLabel: 'COR',
    icon: 'view-column',
    placeholder: 'Ex: A',
  },
  {
    key: 'prateleira',
    label: 'Prateleira',
    cardLabel: 'Prateleira',
    shortLabel: 'Prat',
    compactLabel: 'PRAT',
    icon: 'view-day',
    placeholder: 'Ex: 02',
  },
  {
    key: 'nivel',
    label: 'Nível / Andar',
    cardLabel: 'Nível',
    shortLabel: 'Nível',
    compactLabel: 'NV',
    icon: 'layers',
    placeholder: 'Ex: 1',
  },
  {
    key: 'aereo',
    label: 'Aéreo',
    cardLabel: 'Aéreo',
    shortLabel: 'Aéreo',
    compactLabel: 'AE',
    icon: 'height',
    placeholder: 'Ex: A1',
  },
  {
    key: 'picking',
    label: 'Picking',
    cardLabel: 'Picking',
    shortLabel: 'Picking',
    compactLabel: 'PK',
    icon: 'shopping-cart',
    placeholder: 'Ex: 5',
  },
  {
    key: 'gondola',
    label: 'Gôndola',
    cardLabel: 'Gôndola',
    shortLabel: 'Gôndola',
    compactLabel: 'GON',
    icon: 'storefront',
    placeholder: 'Ex: G7',
  },
  {
    key: 'observacao',
    label: 'Observação de Localização',
    cardLabel: 'Observação',
    shortLabel: 'Obs',
    compactLabel: 'OBS',
    icon: 'notes',
    placeholder: 'Ex: Próximo à doca 2',
  },
];

export const LOGISTICS_LOCATION_FIELD_KEYS = LOGISTICS_LOCATION_FIELDS.map((field) => field.key);
export const LOGISTICS_LOCATION_CONFIG_KEY = 'logisticsLocationConfig';
export const LOGISTICS_LOCATION_CARD_FIELD_ORDER = ['corredor', 'prateleira', 'nivel', 'aereo', 'picking', 'gondola'];

export const DEFAULT_LOGISTICS_LOCATION_CONFIG = LOGISTICS_LOCATION_FIELDS.reduce((accumulator, field) => {
  accumulator[field.key] = {
    enabled: false,
    required: false,
  };
  return accumulator;
}, {});

export const createEmptyLogisticsLocationState = () => (
  LOGISTICS_LOCATION_FIELDS.reduce((accumulator, field) => {
    accumulator[field.key] = '';
    return accumulator;
  }, {})
);

export const normalizeLogisticsLocationConfig = (config = {}) => (
  LOGISTICS_LOCATION_FIELDS.reduce((accumulator, field) => {
    const rawFieldConfig = config?.[field.key] || {};
    const enabled = Boolean(rawFieldConfig?.enabled);

    accumulator[field.key] = {
      enabled,
      required: enabled ? Boolean(rawFieldConfig?.required) : false,
    };

    return accumulator;
  }, {})
);

export const hydrateLogisticsLocation = (location = {}) => (
  LOGISTICS_LOCATION_FIELDS.reduce((accumulator, field) => {
    const value = location?.[field.key];
    accumulator[field.key] = typeof value === 'string' ? value : value == null ? '' : String(value);
    return accumulator;
  }, createEmptyLogisticsLocationState())
);

export const sanitizeLogisticsLocation = (location = {}) => (
  LOGISTICS_LOCATION_FIELDS.reduce((accumulator, field) => {
    const rawValue = location?.[field.key];
    const normalizedValue = typeof rawValue === 'string'
      ? rawValue.trim()
      : rawValue == null
        ? ''
        : String(rawValue).trim();

    if (normalizedValue) {
      accumulator[field.key] = normalizedValue;
    }

    return accumulator;
  }, {})
);

export const getEnabledLogisticsLocationFields = (config = DEFAULT_LOGISTICS_LOCATION_CONFIG) => {
  const safeConfig = normalizeLogisticsLocationConfig(config);
  return LOGISTICS_LOCATION_FIELDS.filter((field) => safeConfig[field.key]?.enabled);
};

export const formatLogisticsLocationSummary = (location = {}, config = DEFAULT_LOGISTICS_LOCATION_CONFIG) => {
  const safeLocation = sanitizeLogisticsLocation(location);
  const safeConfig = normalizeLogisticsLocationConfig(config);

  return LOGISTICS_LOCATION_FIELDS
    .filter((field) => safeConfig[field.key]?.enabled && safeLocation[field.key])
    .map((field) => `${field.shortLabel} ${safeLocation[field.key]}`)
    .join(' • ');
};

export const getLogisticsLocationCardChips = (
  location = {},
  config = DEFAULT_LOGISTICS_LOCATION_CONFIG
) => {
  const safeLocation = sanitizeLogisticsLocation(location);
  const safeConfig = normalizeLogisticsLocationConfig(config);

  const orderedFields = LOGISTICS_LOCATION_CARD_FIELD_ORDER
    .map((fieldKey) => LOGISTICS_LOCATION_FIELDS.find((field) => field.key === fieldKey))
    .filter(Boolean);

  return orderedFields
    .filter((field) => safeConfig[field.key]?.enabled && safeLocation[field.key])
    .map((field) => ({
      key: field.key,
      label: field.cardLabel || field.shortLabel || field.label,
      value: safeLocation[field.key],
    }));
};

export const getLogisticsLocationInfoItems = (
  location = {},
  config = DEFAULT_LOGISTICS_LOCATION_CONFIG
) => {
  const safeLocation = sanitizeLogisticsLocation(location);
  const safeConfig = normalizeLogisticsLocationConfig(config);

  return LOGISTICS_LOCATION_FIELDS
    .filter((field) => safeConfig[field.key]?.enabled && safeLocation[field.key])
    .map((field) => ({
      key: field.key,
      label: field.label,
      value: safeLocation[field.key],
      icon: field.icon,
      compactLabel: field.compactLabel,
      isObservation: field.key === 'observacao',
    }));
};
