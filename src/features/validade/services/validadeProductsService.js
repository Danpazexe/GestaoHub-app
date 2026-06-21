import {
  listValidadeProducts,
  upsertValidadeProduct,
} from '../../../services/validadeSupabaseService';
import {
  readValidadeProductsCache,
  writeValidadeProductsCache,
} from '../storage/validadeProductsStorage';
import { sanitizeLogisticsLocation } from '../constants/logisticsLocation';

const normalizeProducts = (products = []) => (
  (Array.isArray(products) ? products : []).map((item) => ({
    ...item,
    id: item?.id || `${Math.random().toString(36).slice(2, 9)}${Date.now()}`,
    location: sanitizeLogisticsLocation(item?.location),
  }))
);

const hasLocationData = (location = {}) => Object.keys(sanitizeLogisticsLocation(location)).length > 0;

export const mergeRemoteProductsWithCachedLocation = async (remoteProducts = [], cachedProducts) => {
  if (!Array.isArray(remoteProducts)) {
    return remoteProducts;
  }

  const normalizedRemote = normalizeProducts(remoteProducts);
  const normalizedCached = Array.isArray(cachedProducts)
    ? normalizeProducts(cachedProducts)
    : normalizeProducts(await readValidadeProductsCache());
  const cachedById = new Map(normalizedCached.map((item) => [String(item?.id || ''), item]));

  return normalizedRemote.map((remoteItem) => {
    const cachedItem = cachedById.get(String(remoteItem?.id || ''));
    const remoteLocation = sanitizeLogisticsLocation(remoteItem?.location);
    const cachedLocation = sanitizeLogisticsLocation(cachedItem?.location);

    return {
      ...remoteItem,
      location: hasLocationData(remoteLocation) ? remoteLocation : cachedLocation,
    };
  });
};

export const loadValidadeProducts = async ({ preferRemote = true } = {}) => {
  const cached = await readValidadeProductsCache();
  const normalizedCached = normalizeProducts(cached);

  if (preferRemote) {
    try {
      const remoteProducts = await listValidadeProducts();
      if (Array.isArray(remoteProducts)) {
        const mergedRemote = await mergeRemoteProductsWithCachedLocation(remoteProducts, normalizedCached);
        await writeValidadeProductsCache(mergedRemote);
        return mergedRemote;
      }
    } catch (error) {
      console.warn('Falha ao carregar validade no remoto. Usando cache local.', error?.message || error);
    }
  }

  return normalizedCached;
};

export const persistValidadeProducts = async (products = [], { syncRemote = true } = {}) => {
  const normalized = normalizeProducts(products);
  await writeValidadeProductsCache(normalized);

  if (syncRemote) {
    try {
      await Promise.all(normalized.map((product) => upsertValidadeProduct(product)));
    } catch (error) {
      console.warn('Falha ao sincronizar lista de validade.', error?.message || error);
    }
  }

  return normalized;
};

export const replaceValidadeProductsCache = async (products = []) => {
  const merged = await mergeRemoteProductsWithCachedLocation(products);
  await writeValidadeProductsCache(merged);
  return merged;
};

export const listTreatedValidadeProducts = async () => {
  const products = await readValidadeProductsCache();
  return products
    .filter((item) => item?.status === 'treated' || item?.status === 'resolved')
    .sort((a, b) => new Date(b?.treatmentDate || 0) - new Date(a?.treatmentDate || 0));
};

export const deleteValidadeProductRecord = async (productId) => {
  const products = await readValidadeProductsCache();
  const filtered = products.filter((item) => item?.id !== productId);
  await writeValidadeProductsCache(filtered);
  return filtered;
};

export const clearTreatedValidadeProducts = async () => {
  const products = await readValidadeProductsCache();
  const filtered = products.filter((item) => item?.status !== 'treated' && item?.status !== 'resolved');
  await writeValidadeProductsCache(filtered);
  return filtered;
};
