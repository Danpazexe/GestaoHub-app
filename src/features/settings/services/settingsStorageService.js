import { STORAGE_KEYS } from '../../../constants/storage';
import {
  clearAppStorage,
  readJsonStorage,
  readStringStorage,
  writeJsonStorage,
  writeStringStorage,
} from '../../../services/appStorageService';

export const loadSettingsData = async () => {
  const [settings, biometricEnabled] = await Promise.all([
    readJsonStorage(STORAGE_KEYS.USER_SETTINGS, {}),
    readStringStorage(STORAGE_KEYS.BIOMETRIC_ENABLED, ''),
  ]);
  const hasStoredBiometricPreference =
    biometricEnabled === 'true' || biometricEnabled === 'false';

  return {
    biometric: hasStoredBiometricPreference
      ? biometricEnabled === 'true'
      : Boolean(settings?.biometric),
    autoBackup: Boolean(settings?.autoBackup),
    darkMode: Boolean(settings?.darkMode),
  };
};

export const loadThemePreference = async () => {
  const settings = await readJsonStorage(STORAGE_KEYS.USER_SETTINGS, {});

  if (typeof settings?.darkMode === 'boolean') {
    return settings.darkMode;
  }

  return null;
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
  const current = await readJsonStorage(STORAGE_KEYS.USER_SETTINGS, {});
  const nextEnabled = Boolean(enabled);

  await Promise.all([
    writeStringStorage(STORAGE_KEYS.BIOMETRIC_ENABLED, nextEnabled ? 'true' : 'false'),
    writeJsonStorage(STORAGE_KEYS.USER_SETTINGS, {
      ...current,
      biometric: nextEnabled,
    }),
  ]);
};

export const resetAllLocalData = async () => {
  await clearAppStorage();
};
