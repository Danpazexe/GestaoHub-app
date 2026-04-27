import { loadCachedProducts } from '../../../services/productLookupService';

const readValue = (item = {}, keys = []) => {
  for (const key of keys) {
    const value = item?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }

  return '';
};

const normalizeCatalogItem = (item = {}) => {
  const code = readValue(item, ['CODPROD', 'codprod', 'id']);
  const ean = readValue(item, ['CODAUXILIAR', 'codauxiliar', 'ean']);
  const dun = readValue(item, ['CODAUXILIAR2', 'codauxiliar2', 'dun']);
  const description = readValue(item, ['DESCRICAO', 'descricao', 'nome']);

  if (!code && !ean && !dun && !description) {
    return null;
  }

  return {
    code,
    ean,
    dun,
    description,
  };
};

export const listConferenceCatalogItems = async () => {
  const products = await loadCachedProducts();

  return products
    .map(normalizeCatalogItem)
    .filter((item) => item && (item.code || item.ean || item.dun || item.description));
};

export const hasConferenceCatalog = async () => {
  const items = await listConferenceCatalogItems();
  return items.length > 0;
};
