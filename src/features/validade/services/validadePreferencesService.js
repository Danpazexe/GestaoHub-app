import { STORAGE_KEYS } from '../../../constants/storage';
import { readStringStorage, writeStringStorage } from '../../../services/appStorageService';

export const readLookupSqlPreference = async () => {
  const savedValue = await readStringStorage(STORAGE_KEYS.LOOKUP_SQL_PREF, '');
  if (savedValue === '') {
    return true;
  }

  return savedValue === 'true';
};

export const writeLookupSqlPreference = async (enabled) => {
  await writeStringStorage(STORAGE_KEYS.LOOKUP_SQL_PREF, String(Boolean(enabled)));
  return Boolean(enabled);
};
