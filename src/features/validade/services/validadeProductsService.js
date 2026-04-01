import {
  listValidadeProducts,
  upsertValidadeProduct,
} from '../../../services/validadeSupabaseService';
import {
  readValidadeProductsCache,
  writeValidadeProductsCache,
} from '../storage/validadeProductsStorage';

const normalizeProducts = (products = []) => (
  (Array.isArray(products) ? products : []).map((item) => ({
    ...item,
    id: item?.id || `${Math.random().toString(36).slice(2, 9)}${Date.now()}`,
  }))
);

export const loadValidadeProducts = async ({ preferRemote = true } = {}) => {
  if (preferRemote) {
    try {
      const remoteProducts = await listValidadeProducts();
      if (Array.isArray(remoteProducts)) {
        const normalizedRemote = normalizeProducts(remoteProducts);
        await writeValidadeProductsCache(normalizedRemote);
        return normalizedRemote;
      }
    } catch (error) {
      console.warn('Falha ao carregar validade no remoto. Usando cache local.', error?.message || error);
    }
  }

  const cached = await readValidadeProductsCache();
  return normalizeProducts(cached);
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
  const normalized = normalizeProducts(products);
  await writeValidadeProductsCache(normalized);
  return normalized;
};

export const listTreatedValidadeProducts = async () => {
  const products = await readValidadeProductsCache();
  return products
    .filter((item) => item?.status === 'treated')
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
  const filtered = products.filter((item) => item?.status !== 'treated');
  await writeValidadeProductsCache(filtered);
  return filtered;
};
