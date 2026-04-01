import { STORAGE_KEYS } from '../../../constants/storage';
import {
  readJsonStorage,
  writeJsonStorage,
} from '../../../services/appStorageService';

const ensureArray = (value) => (Array.isArray(value) ? value : []);

export const readAvariaBatches = async () => {
  const parsed = await readJsonStorage(STORAGE_KEYS.AVARIA_BATCHES, []);
  return ensureArray(parsed);
};

export const writeAvariaBatches = async (batches = []) => {
  const safeBatches = ensureArray(batches);
  await writeJsonStorage(STORAGE_KEYS.AVARIA_BATCHES, safeBatches);
  return safeBatches;
};
