import { readJsonStorage, writeJsonStorage } from '../../../services/appStorageService';

const ensureArray = (value) => (Array.isArray(value) ? value : []);

export const readConferenciaCollection = async (storageKey) => {
  const parsed = await readJsonStorage(storageKey, []);
  return ensureArray(parsed);
};

export const writeConferenciaCollection = async (storageKey, list = [], maxItems = 300) => {
  const clipped = ensureArray(list).slice(0, maxItems);
  await writeJsonStorage(storageKey, clipped);
  return clipped;
};

export const prependConferenciaCollectionItem = async (storageKey, item, maxItems = 300) => {
  const current = await readConferenciaCollection(storageKey);
  return writeConferenciaCollection(storageKey, [item, ...current], maxItems);
};
