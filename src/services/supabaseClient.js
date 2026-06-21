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
          // Persistir a sessão no AsyncStorage e restaurá-la no boot é o que
          // garante que auth.getUser() funcione após reabrir o app — sem isso,
          // toda sincronização remota falhava silenciosamente ("não autenticado").
          storage: AsyncStorage,
          persistSession: true,
          autoRefreshToken: true,
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
