import { Platform } from 'react-native';

import { getSupabaseClient } from './supabaseClient';
import { getCurrentUserId } from './validadeSupabaseService';

// Sessão de presença ativa (in-memory). É criada na primeira batida de heartbeat
// em que houver um usuário Supabase autenticado, e reutilizada nas seguintes.
let activeSessionId = null;
let isCreatingSession = false;
let cachedAppVersion = null;

const getAppVersion = () => {
  if (cachedAppVersion) return cachedAppVersion;
  try {
    // eslint-disable-next-line global-require
    cachedAppVersion = require('../../package.json').version || '0.0.0';
  } catch {
    cachedAppVersion = '0.0.0';
  }
  return cachedAppVersion;
};

const safeUserId = async () => {
  try {
    return await getCurrentUserId();
  } catch {
    // Usuário não autenticado (ex.: dev user / antes do login) → presença é no-op.
    return null;
  }
};

export const getActiveSessionId = () => activeSessionId;

export const deriveModuleFromRoute = (routeName = '') => {
  const name = String(routeName || '');
  if (/^Avaria/.test(name)) return 'avaria';
  if (/^Conferencia/.test(name)) return 'conferencia';
  if (/Tratativa|Recebimento|Espelho/.test(name)) return 'recebimento';
  if (['ListScreen', 'AddProductScreen', 'DashboardScreen', 'ExcelScreen', 'TratarScreen', 'PdfScreen'].includes(name)) {
    return 'validade';
  }
  if (name === 'SqlScreen') return 'sql';
  if (name === 'SettingsScreen' || name === 'EnderecosScreen') return 'settings';
  if (name === 'NotificationSettings') return 'notifications';
  if (name === 'ProfileScreen') return 'profile';
  return 'app';
};

// Cria a sessão (se ainda não existe) ou atualiza o heartbeat/contexto.
// Nunca lança: presença é best-effort e não pode quebrar a navegação.
export const reportPresence = async ({
  status = 'online',
  module,
  screen,
  orderRef,
  batchRef,
} = {}) => {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const userId = await safeUserId();
  if (!userId) return null;

  try {
    if (!activeSessionId) {
      // Evita criar duas linhas de presença se duas chamadas concorrerem logo após o login.
      if (isCreatingSession) return null;
      isCreatingSession = true;
      try {
        const { data, error } = await supabase
          .from('user_presence')
          .insert([
            {
              user_id: userId,
              platform: Platform.OS,
              app_version: getAppVersion(),
              device_label: `${Platform.OS} app`,
              current_module: module || null,
              current_screen: screen || null,
              current_order_ref: orderRef || null,
              current_batch_ref: batchRef || null,
              status,
            },
          ])
          .select('session_id')
          .single();

        if (error) throw error;
        activeSessionId = data?.session_id || null;
        return activeSessionId;
      } finally {
        isCreatingSession = false;
      }
    }

    const patch = { status, last_heartbeat_at: new Date().toISOString() };
    if (module !== undefined) patch.current_module = module || null;
    if (screen !== undefined) patch.current_screen = screen || null;
    if (orderRef !== undefined) patch.current_order_ref = orderRef || null;
    if (batchRef !== undefined) patch.current_batch_ref = batchRef || null;

    const { error } = await supabase
      .from('user_presence')
      .update(patch)
      .eq('session_id', activeSessionId);

    if (error) throw error;
    return activeSessionId;
  } catch (error) {
    console.warn('[presence] Falha ao reportar presença.', error?.message || error);
    return null;
  }
};

export const setPresenceStatus = async (status) => reportPresence({ status });

// Encerra a presença. Deve rodar ANTES do signOut (depois do signOut a RLS
// rejeita o update porque auth.uid() fica nulo).
export const endPresence = async () => {
  const supabase = getSupabaseClient();
  if (!supabase || !activeSessionId) {
    activeSessionId = null;
    return;
  }

  try {
    await supabase
      .from('user_presence')
      .update({ status: 'signed_out', signed_out_at: new Date().toISOString() })
      .eq('session_id', activeSessionId);
  } catch (error) {
    console.warn('[presence] Falha ao encerrar presença.', error?.message || error);
  } finally {
    activeSessionId = null;
  }
};
