import { STORAGE_KEYS } from '../../../constants/storage';
import {
  readJsonStorage,
  writeJsonStorage,
  readStringStorage,
  writeStringStorage,
} from '../../../services/appStorageService';

const ensureArray = (value) => (Array.isArray(value) ? value : []);

export const readValidadeProductsCache = async () => {
  const parsed = await readJsonStorage(STORAGE_KEYS.PRODUCTS, []);
  return ensureArray(parsed);
};

export const writeValidadeProductsCache = async (products = []) => {
  const safeProducts = ensureArray(products);
  await writeJsonStorage(STORAGE_KEYS.PRODUCTS, safeProducts);
  return safeProducts;
};

export const readValidadeHistoryMeta = async () => {
  const [lastExport, lastImport] = await Promise.all([
    readStringStorage(STORAGE_KEYS.LAST_EXPORT_VALIDADE, ''),
    readStringStorage(STORAGE_KEYS.LAST_IMPORT_VALIDADE, ''),
  ]);

  return {
    lastExport,
    lastImport,
  };
};

export const writeLastValidadeExport = async (value) => {
  await writeStringStorage(STORAGE_KEYS.LAST_EXPORT_VALIDADE, value);
  return value;
};

export const writeLastValidadeImport = async (value) => {
  await writeStringStorage(STORAGE_KEYS.LAST_IMPORT_VALIDADE, value);
  return value;
};
