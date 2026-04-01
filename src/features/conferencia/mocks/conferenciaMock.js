import { loadCachedProducts } from '../../../services/productLookupService';

const FALLBACK_PRODUCTS = [
  { CODPROD: '1001', CODAUXILIAR: '7891001000011', DESCRICAO: 'Arroz Tipo 1 5kg' },
  { CODPROD: '1002', CODAUXILIAR: '7891001000028', DESCRICAO: 'Feijão Carioca 1kg' },
  { CODPROD: '1003', CODAUXILIAR: '7891001000035', DESCRICAO: 'Óleo de Soja 900ml' },
  { CODPROD: '1004', CODAUXILIAR: '7891001000042', DESCRICAO: 'Açúcar Refinado 1kg' },
  { CODPROD: '1005', CODAUXILIAR: '7891001000059', DESCRICAO: 'Macarrão Espaguete 500g' },
  { CODPROD: '1006', CODAUXILIAR: '7891001000066', DESCRICAO: 'Café Torrado 500g' },
  { CODPROD: '1007', CODAUXILIAR: '7891001000073', DESCRICAO: 'Leite UHT Integral 1L' },
  { CODPROD: '1008', CODAUXILIAR: '7891001000080', DESCRICAO: 'Farinha de Trigo 1kg' },
];

const normalizeProduct = (product) => {
  const code = String(product.CODPROD ?? product.codprod ?? '').trim();
  const ean = String(product.CODAUXILIAR ?? product.codauxiliar ?? '').trim();
  const description = String(product.DESCRICAO ?? product.descricao ?? '').trim();

  // Best-effort only: catalog is local and can be incomplete.
  const dun = ean && ean.length === 13 ? `1${ean}` : ean && ean.length === 12 ? `0${ean}` : '';
  return {
    code,
    ean,
    dun,
    description: description || `Produto ${code || ean || 'sem código'}`,
  };
};

const hashString = (value) => {
  let hash = 0;
  const str = String(value || '');
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const digitsOnly = (value) => String(value || '').replace(/[^0-9]/g, '');

const makeNumericCode = (seed, len) => {
  const mod = 10 ** len;
  const num = hashString(seed) % mod;
  return String(num).padStart(len, '0');
};

const deriveEan13 = (baseEan, seed) => {
  const baseDigits = digitsOnly(baseEan);
  if (baseDigits.length === 13) return baseDigits;
  return makeNumericCode(seed, 13);
};

const ean13ToDun14 = (ean13) => {
  const digits = digitsOnly(ean13);
  if (digits.length !== 13) return makeNumericCode(`DUN::${ean13}`, 14);
  return `1${digits}`;
};

const buildPackagingOptions = ({ unitEan, unitDun, seed }) => {
  const cxEan = makeNumericCode(`${seed}::CX::${unitEan}`, 13);
  const fdEan = makeNumericCode(`${seed}::FD::${unitEan}`, 13);
  const cxDun = ean13ToDun14(cxEan);
  const fdDun = ean13ToDun14(fdEan);

  return [
    // DUN costuma ser embalagem logística (caixa/fardo). Para unidade, manter vazio.
    { id: 'un', label: 'UN', factor: 1, ean: unitEan, dun: '' },
    { id: 'cx', label: 'CX', factor: 6, ean: cxEan, dun: cxDun },
    { id: 'fd', label: 'FD', factor: 12, ean: fdEan, dun: fdDun },
  ];
};

export const loadLocalCatalog = async () => {
  try {
    const parsed = await loadCachedProducts();
    const normalized = parsed.map(normalizeProduct).filter((item) => item.code || item.ean);
    if (normalized.length > 0) return normalized;
  } catch {
    // fallback below
  }
  return FALLBACK_PRODUCTS.map(normalizeProduct);
};

export const buildExpectedItems = async (seedKey, count = 18) => {
  const catalog = await loadLocalCatalog();
  const seed = hashString(seedKey);
  const max = Math.min(count, catalog.length);
  const selected = [];

  for (let i = 0; i < max; i += 1) {
    const idx = (seed + i * 17) % catalog.length;
    const base = catalog[idx];
    const qty = ((seed + i * 13) % 6) + 1;

    const unitEan = deriveEan13(base.ean, `EAN::${seedKey}::${base.code || base.ean}::${i}`);
    const unitDun = '';
    const packagingOptions = buildPackagingOptions({
      unitEan,
      unitDun,
      seed: `PACK::${seedKey}::${base.code || base.ean}::${i}`,
    });

    selected.push({
      id: `${seedKey}-${base.code || base.ean}-${i}`,
      code: base.code || `SEM-${i + 1}`,
      ean: unitEan,
      dun: unitDun,
      description: base.description,
      expectedQty: qty,
      checkedQty: 0,
      packagingOptions,
      lastMeta: null,
      reads: [],
    });
  }

  return selected;
};

export const buildExpectedItemsEntrada = async (invoice, count = 16) => {
  return buildExpectedItems(`ENTRADA::${String(invoice || '').trim().toUpperCase()}`, count);
};

export const buildExpectedItemsSaida = async (orderCode, count = 20) => {
  const catalog = await loadLocalCatalog();
  const seed = hashString(`SAIDA::${String(orderCode || '').trim().toUpperCase()}`);
  const max = Math.min(count, catalog.length);
  const selected = [];

  for (let i = 0; i < max; i += 1) {
    const idx = (seed + i * 11 + 3) % catalog.length;
    const base = catalog[idx];
    const qty = ((seed + i * 7) % 4) + 1;

    const seedKey = `SAIDA::${String(orderCode || '').trim().toUpperCase()}`;
    const unitEan = deriveEan13(base.ean, `EAN::${seedKey}::${base.code || base.ean}::${i}`);
    const unitDun = '';
    const packagingOptions = buildPackagingOptions({
      unitEan,
      unitDun,
      seed: `PACK::${seedKey}::${base.code || base.ean}::${i}`,
    });

    selected.push({
      id: `saida-${orderCode}-${base.code || base.ean}-${i}`,
      code: base.code || `SEM-${i + 1}`,
      ean: unitEan,
      dun: unitDun,
      description: base.description,
      expectedQty: qty,
      checkedQty: 0,
      packagingOptions,
      lastMeta: null,
      reads: [],
    });
  }

  return selected;
};
