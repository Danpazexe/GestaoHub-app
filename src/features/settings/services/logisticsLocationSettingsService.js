import { STORAGE_KEYS } from '../../../constants/storage';
import { getSupabaseClient } from '../../../services/supabaseClient';
import {
  readJsonStorage,
  writeJsonStorage,
} from '../../../services/appStorageService';
import {
  DEFAULT_LOGISTICS_LOCATION_CONFIG,
  LOGISTICS_LOCATION_CONFIG_KEY,
  normalizeLogisticsLocationConfig,
} from '../../validade/constants/logisticsLocation';

const USER_SETTINGS_TABLE = 'user_settings';

const getAuthenticatedUserId = async () => {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) {
    return null;
  }

  return data.user.id;
};

export const readLocalLogisticsLocationConfig = async () => {
  const settings = await readJsonStorage(STORAGE_KEYS.USER_SETTINGS, {});
  return normalizeLogisticsLocationConfig(settings?.[LOGISTICS_LOCATION_CONFIG_KEY]);
};

export const writeLocalLogisticsLocationConfig = async (config) => {
  const normalizedConfig = normalizeLogisticsLocationConfig(config);
  const settings = await readJsonStorage(STORAGE_KEYS.USER_SETTINGS, {});

  await writeJsonStorage(STORAGE_KEYS.USER_SETTINGS, {
    ...settings,
    [LOGISTICS_LOCATION_CONFIG_KEY]: normalizedConfig,
  });

  return normalizedConfig;
};

export const readRemoteLogisticsLocationConfig = async () => {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const userId = await getAuthenticatedUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from(USER_SETTINGS_TABLE)
    .select('extra')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'Falha ao carregar configuração logística remota');
  }

  const remoteConfig = data?.extra?.[LOGISTICS_LOCATION_CONFIG_KEY];
  if (!remoteConfig) {
    return null;
  }

  return normalizeLogisticsLocationConfig(remoteConfig);
};

export const writeRemoteLogisticsLocationConfig = async (config) => {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const userId = await getAuthenticatedUserId();
  if (!userId) return null;

  const normalizedConfig = normalizeLogisticsLocationConfig(config);
  const { data: existingSettings, error: readError } = await supabase
    .from(USER_SETTINGS_TABLE)
    .select('extra')
    .eq('user_id', userId)
    .maybeSingle();

  if (readError) {
    throw new Error(readError.message || 'Falha ao ler configuração remota atual');
  }

  const nextExtra = {
    ...(existingSettings?.extra || {}),
    [LOGISTICS_LOCATION_CONFIG_KEY]: normalizedConfig,
  };

  const { error } = await supabase
    .from(USER_SETTINGS_TABLE)
    .upsert(
      [{
        user_id: userId,
        extra: nextExtra,
      }],
      { onConflict: 'user_id' }
    );

  if (error) {
    throw new Error(error.message || 'Falha ao salvar configuração logística remota');
  }

  return normalizedConfig;
};

export const loadLogisticsLocationConfig = async () => {
  const localConfig = await readLocalLogisticsLocationConfig();

  try {
    const remoteConfig = await readRemoteLogisticsLocationConfig();
    if (remoteConfig) {
      await writeLocalLogisticsLocationConfig(remoteConfig);
      return remoteConfig;
    }
  } catch (error) {
    console.warn('Falha ao sincronizar configuração logística remota. Mantendo cache local.', error?.message || error);
  }

  return localConfig || DEFAULT_LOGISTICS_LOCATION_CONFIG;
};

export const saveLogisticsLocationConfig = async (config) => {
  const normalizedConfig = await writeLocalLogisticsLocationConfig(config);

  try {
    await writeRemoteLogisticsLocationConfig(normalizedConfig);
  } catch (error) {
    console.warn('Falha ao salvar configuração logística remota. Mantendo cache local.', error?.message || error);
  }

  return normalizedConfig;
};
