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
          persistSession: false,
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
