import { STORAGE_KEYS } from '../constants/storage';
import { readJsonStorage, readStringStorage } from './appStorageService';

export const readStoredUserData = async () => {
  return readJsonStorage(STORAGE_KEYS.USER_DATA, null);
};

export const readStoredUserName = async (fallback = '---') => {
  try {
    const user = await readStoredUserData();
    const directName = String(user?.name || user?.nome || '').trim();
    if (directName) {
      return directName;
    }

    const profileName = await readStringStorage(STORAGE_KEYS.PROFILE_NAME, '');
    return String(profileName || '').trim() || fallback;
  } catch {
    return fallback;
  }
};

export const readStoredUserSummary = async () => {
  const user = await readStoredUserData();
  const fallbackName = await readStringStorage(STORAGE_KEYS.PROFILE_NAME, '');

  return {
    data: user,
    name: String(user?.name || user?.nome || fallbackName || '').trim() || 'Usuário',
    email: String(user?.email || '').trim(),
  };
};
