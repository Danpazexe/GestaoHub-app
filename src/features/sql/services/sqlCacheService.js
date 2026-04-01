import { STORAGE_KEYS } from '../../../constants/storage';
import { writeJsonStorage } from '../../../services/appStorageService';

export const replaceSqlCacheProducts = async (products = []) => {
  const normalized = Array.isArray(products) ? products : [];
  await writeJsonStorage(STORAGE_KEYS.SQL_CACHE, normalized);
  return normalized;
};

export const clearSqlCacheProducts = async () => {
  await writeJsonStorage(STORAGE_KEYS.SQL_CACHE, []);
  return [];
};
