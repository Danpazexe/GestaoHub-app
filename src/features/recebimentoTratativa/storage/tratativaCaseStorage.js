import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../../constants/storage';
import { normalizeTratativaCase } from '../mappers/tratativaCaseMapper';

const LEGACY_STORAGE_KEY = 'tratativa_cases';

export const readTratativaCasesCache = async () => {
  try {
    const primaryRaw = await AsyncStorage.getItem(STORAGE_KEYS.RECEBIMENTO_TREATMENT_CASES);
    const raw = primaryRaw ?? await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const normalized = Array.isArray(parsed) ? parsed.map((item) => normalizeTratativaCase(item)) : [];
    const shouldRewriteCache = raw != null && JSON.stringify(parsed) !== JSON.stringify(normalized);

    if ((primaryRaw == null && normalized.length > 0) || shouldRewriteCache) {
      await AsyncStorage.setItem(
        STORAGE_KEYS.RECEBIMENTO_TREATMENT_CASES,
        JSON.stringify(normalized),
      );
    }

    return normalized;
  } catch (error) {
    console.warn('Falha ao ler cache de tratativas.', error?.message || error);
    return [];
  }
};

export const writeTratativaCasesCache = async (cases = []) => {
  const normalized = Array.isArray(cases)
    ? cases.map((item) => normalizeTratativaCase(item))
    : [];
  await AsyncStorage.setItem(STORAGE_KEYS.RECEBIMENTO_TREATMENT_CASES, JSON.stringify(normalized));
  return normalized;
};
