import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from './supabaseConfig';

let supabaseSingleton = null;

export const isSupabaseConfigured = () =>
  Boolean(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey);

export const getSupabaseClient = () => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!supabaseSingleton) {
    try {
      supabaseSingleton = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
        auth: {
          // Sessão persiste localmente (necessário p/ sync após reabrir o app),
          // mas SEM refresh em background:
          //  - autoRefreshToken:false evita o timer/AppState do supabase-js no RN
          //    (suspeito da tela preta) e reduz requisições no plano FREE;
          //  - o token expirado é renovado sob demanda quando getSession() é chamado.
          storage: AsyncStorage,
          persistSession: true,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });
    } catch (error) {
      console.warn('[SupabaseClient] Falha ao criar client.', error?.message || error);
      return null;
    }
  }

  return supabaseSingleton;
};
