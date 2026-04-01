import { STORAGE_KEYS } from '../../../constants/storage';
import {
  clearAppStorage,
  readJsonStorage,
  readStringStorage,
  writeJsonStorage,
  writeStringStorage,
} from '../../../services/appStorageService';

export const loadSettingsData = async () => {
  const settings = await readJsonStorage(STORAGE_KEYS.USER_SETTINGS, {});
  return {
    biometric: Boolean(settings?.biometric),
    autoBackup: Boolean(settings?.autoBackup),
    darkMode: Boolean(settings?.darkMode),
  };
};

export const saveSettingsValue = async (key, value) => {
  const current = await readJsonStorage(STORAGE_KEYS.USER_SETTINGS, {});
  const next = {
    ...current,
    [key]: value,
  };
  await writeJsonStorage(STORAGE_KEYS.USER_SETTINGS, next);
  return next;
};

export const loadSavedAuthPreferences = async () => {
  const [savedEmail, savedPassword, biometricEnabled] = await Promise.all([
    readStringStorage(STORAGE_KEYS.SAVED_EMAIL, ''),
    readStringStorage(STORAGE_KEYS.SAVED_PASSWORD, ''),
    readStringStorage(STORAGE_KEYS.BIOMETRIC_ENABLED, ''),
  ]);

  return {
    savedEmail,
    savedPassword,
    biometricEnabled: biometricEnabled === 'true',
  };
};

export const saveBiometricEnabled = async (enabled) => {
  await writeStringStorage(STORAGE_KEYS.BIOMETRIC_ENABLED, enabled ? 'true' : 'false');
};

export const resetAllLocalData = async () => {
  await clearAppStorage();
};
