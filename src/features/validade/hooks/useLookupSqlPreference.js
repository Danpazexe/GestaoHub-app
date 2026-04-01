import { useCallback, useEffect, useState } from 'react';
import Toast from 'react-native-toast-message';
import {
  readLookupSqlPreference,
  writeLookupSqlPreference,
} from '../services/validadePreferencesService';

export const useLookupSqlPreference = () => {
  const [isSqlLookupEnabled, setIsSqlLookupEnabled] = useState(true);
  const [isSqlLookupLoaded, setIsSqlLookupLoaded] = useState(false);

  useEffect(() => {
    const loadPreference = async () => {
      try {
        const savedValue = await readLookupSqlPreference();
        setIsSqlLookupEnabled(savedValue);
      } catch (error) {
        console.error('Erro ao carregar preferência de busca:', error);
      } finally {
        setIsSqlLookupLoaded(true);
      }
    };

    loadPreference();
  }, []);

  const persistSqlLookupPreference = useCallback(async (nextValue) => {
    setIsSqlLookupEnabled(nextValue);
    try {
      await writeLookupSqlPreference(nextValue);
      Toast.show({
        type: 'success',
        text1: 'Opções atualizadas',
        text2: nextValue ? 'Busca no banco ativada.' : 'Busca no banco desativada.',
        visibilityTime: 2000,
      });
    } catch (error) {
      console.error('Erro ao salvar preferência de busca:', error);
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Não foi possível salvar sua preferência.',
        visibilityTime: 2500,
      });
    }
  }, []);

  return {
    isSqlLookupEnabled,
    isSqlLookupLoaded,
    persistSqlLookupPreference,
    setIsSqlLookupEnabled,
  };
};

export default useLookupSqlPreference;
