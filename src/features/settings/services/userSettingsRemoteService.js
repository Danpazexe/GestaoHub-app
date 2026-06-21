import { STORAGE_KEYS } from '../../../constants/storage';
import { readJsonStorage } from '../../../services/appStorageService';
import { getSupabaseClient } from '../../../services/supabaseClient';

const USER_SETTINGS_TABLE = 'user_settings';

const getAuthenticatedUserId = async () => {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) return null;
  return data.user.id;
};

// Sincroniza as colunas tipadas de user_settings preservando `extra`
// (que é gerenciado pelo serviço de localização logística).
export const upsertUserSettingsRemote = async (settings = null) => {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    console.warn('[settings] Sincronização remota ignorada: usuário não autenticado no Supabase.');
    return;
  }

  const local = settings || (await readJsonStorage(STORAGE_KEYS.USER_SETTINGS, {})) || {};

  const { data: existing, error: readError } = await supabase
    .from(USER_SETTINGS_TABLE)
    .select('extra')
    .eq('user_id', userId)
    .maybeSingle();
  if (readError) throw new Error(readError.message || 'Falha ao ler settings remotos');

  const row = {
    user_id: userId,
    dark_mode: Boolean(local.darkMode),
    biometric_enabled: Boolean(local.biometric),
    auto_backup: Boolean(local.autoBackup),
    // Não tocamos em `extra` (mantém a config de localização logística intacta).
    extra: existing?.extra || {},
  };

  const { error } = await supabase
    .from(USER_SETTINGS_TABLE)
    .upsert([row], { onConflict: 'user_id' });
  if (error) throw new Error(error.message || 'Falha ao salvar settings remotos');
};
