import { useCallback, useEffect, useState } from 'react';
import Toast from 'react-native-toast-message';
import {
  DEFAULT_LOGISTICS_LOCATION_CONFIG,
  normalizeLogisticsLocationConfig,
} from '../../validade/constants/logisticsLocation';
import {
  readLocalLogisticsLocationConfig,
  readRemoteLogisticsLocationConfig,
  saveLogisticsLocationConfig,
  writeLocalLogisticsLocationConfig,
} from '../services/logisticsLocationSettingsService';

export const useLogisticsLocationConfig = () => {
  const [config, setConfig] = useState(DEFAULT_LOGISTICS_LOCATION_CONFIG);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    const loadConfig = async () => {
      try {
        const localConfig = await readLocalLogisticsLocationConfig();
        if (active) {
          setConfig(localConfig);
          setIsLoaded(true);
        }

        const remoteConfig = await readRemoteLogisticsLocationConfig();
        if (!remoteConfig) {
          return;
        }

        await writeLocalLogisticsLocationConfig(remoteConfig);
        if (active) {
          setConfig(remoteConfig);
        }
      } catch (error) {
        console.error('Erro ao carregar configuração logística:', error);
        if (active) {
          setIsLoaded(true);
        }
      }
    };

    loadConfig();

    return () => {
      active = false;
    };
  }, []);

  const persistConfig = useCallback(async (nextConfig) => {
    const normalizedConfig = normalizeLogisticsLocationConfig(nextConfig);
    const previousConfig = config;

    setConfig(normalizedConfig);

    try {
      const savedConfig = await saveLogisticsLocationConfig(normalizedConfig);
      setConfig(savedConfig);
      return savedConfig;
    } catch (error) {
      console.error('Erro ao salvar configuração logística:', error);
      setConfig(previousConfig);
      Toast.show({
        type: 'error',
        text1: 'Erro ao salvar configuração',
        text2: 'Não foi possível atualizar a localização logística.',
        visibilityTime: 2500,
      });
      return previousConfig;
    }
  }, [config]);

  const toggleFieldEnabled = useCallback((fieldKey, enabled) => {
    const currentFieldConfig = config?.[fieldKey] || {};

    return persistConfig({
      ...config,
      [fieldKey]: {
        ...currentFieldConfig,
        enabled: Boolean(enabled),
        required: enabled ? Boolean(currentFieldConfig.required) : false,
      },
    });
  }, [config, persistConfig]);

  const toggleFieldRequired = useCallback((fieldKey, required) => {
    const currentFieldConfig = config?.[fieldKey] || {};
    const isFieldEnabled = Boolean(currentFieldConfig.enabled);

    return persistConfig({
      ...config,
      [fieldKey]: {
        ...currentFieldConfig,
        enabled: isFieldEnabled,
        required: isFieldEnabled ? Boolean(required) : false,
      },
    });
  }, [config, persistConfig]);

  return {
    config,
    isLoaded,
    saveConfig: persistConfig,
    toggleFieldEnabled,
    toggleFieldRequired,
  };
};

export default useLogisticsLocationConfig;
