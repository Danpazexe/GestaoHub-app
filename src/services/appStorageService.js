import AsyncStorage from '@react-native-async-storage/async-storage';

export const readJsonStorage = async (key, fallbackValue = null) => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallbackValue;
  } catch (error) {
    console.warn(`Falha ao ler storage JSON: ${key}`, error?.message || error);
    return fallbackValue;
  }
};

export const writeJsonStorage = async (key, value) => {
  await AsyncStorage.setItem(key, JSON.stringify(value));
  return value;
};

export const readStringStorage = async (key, fallbackValue = '') => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ?? fallbackValue;
  } catch (error) {
    console.warn(`Falha ao ler storage string: ${key}`, error?.message || error);
    return fallbackValue;
  }
};

export const writeStringStorage = async (key, value) => {
  await AsyncStorage.setItem(key, String(value ?? ''));
  return value;
};

export const removeStorageKeys = async (keys = []) => {
  if (!Array.isArray(keys) || keys.length === 0) return;
  await AsyncStorage.multiRemove(keys);
};

export const clearAppStorage = async () => {
  await AsyncStorage.clear();
};
