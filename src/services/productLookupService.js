import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/storage';

const PRODUCT_LOOKUP_FIELDS = {
  codprod: ['CODPROD', 'codprod', 'id'],
  descricao: ['DESCRICAO', 'descricao', 'nome'],
  marca: ['MARCA', 'marca'],
  codauxiliar: ['CODAUXILIAR', 'codauxiliar', 'ean'],
  codauxiliar2: ['CODAUXILIAR2', 'codauxiliar2', 'dun'],
  fornecedor: ['FORNECEDOR', 'fornecedor', 'supplierName'],
  supplierCode: ['CODFORNEC', 'codfornec', 'supplierCode'],
};

const readAny = (item = {}, keys = []) => {
  for (const key of keys) {
    const value = item?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return '';
};

export const getLookupField = (item = {}, field) => {
  return String(readAny(item, PRODUCT_LOOKUP_FIELDS[field] || []) || '');
};

export const loadCachedProducts = async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.SQL_CACHE);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Falha ao ler cache de produtos.', error?.message || error);
    return [];
  }
};

export const searchCachedProducts = async (query, limit = 15) => {
  const cleanQuery = String(query || '').toLowerCase().trim();
  if (!cleanQuery) return [];

  const products = await loadCachedProducts();
  return products.filter((item) => {
    const haystack = [
      getLookupField(item, 'descricao'),
      getLookupField(item, 'marca'),
      getLookupField(item, 'codprod'),
      getLookupField(item, 'codauxiliar'),
      getLookupField(item, 'codauxiliar2'),
      getLookupField(item, 'fornecedor'),
      getLookupField(item, 'supplierCode'),
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(cleanQuery);
  }).slice(0, limit);
};

export const findCachedProductByEan = async (ean) => {
  const normalizedEan = String(ean || '').trim();
  if (!normalizedEan) return null;

  const products = await loadCachedProducts();
  return products.find((item) => {
    const primary = getLookupField(item, 'codauxiliar').trim();
    const secondary = getLookupField(item, 'codauxiliar2').trim();
    return primary === normalizedEan || secondary === normalizedEan;
  }) || null;
};

export const buildLookupSelection = (product = {}) => ({
  codprod: getLookupField(product, 'codprod'),
  descricao: getLookupField(product, 'descricao'),
  codauxiliar: getLookupField(product, 'codauxiliar') || getLookupField(product, 'codauxiliar2'),
  fornecedor: getLookupField(product, 'fornecedor'),
  supplierCode: getLookupField(product, 'supplierCode'),
});
