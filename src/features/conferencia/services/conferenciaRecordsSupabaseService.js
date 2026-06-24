import { getSupabaseClient } from '../../../services/supabaseClient';
import { getCurrentUserId } from '../../../services/validadeSupabaseService';

const RECEBIMENTOS_TABLE = 'conferencia_recebimentos';
const SAIDAS_TABLE = 'conferencia_saidas';
const DIVERGENCIAS_TABLE = 'conferencia_divergencias';

const upsertRecord = async (supabase, userId, table, record) => {
  if (!record?.id) return;
  const { error } = await supabase
    .from(table)
    .upsert([{ id: String(record.id), user_id: userId, payload: record }], { onConflict: 'user_id,id' });
  if (error) throw new Error(error.message || `Falha ao sincronizar ${table}`);
};

const upsertDivergencias = async (supabase, userId, divergences) => {
  const rows = (Array.isArray(divergences) ? divergences : [])
    .filter((item) => item?.id)
    .map((item) => ({ id: String(item.id), user_id: userId, payload: item }));
  if (rows.length === 0) return;

  const { error } = await supabase
    .from(DIVERGENCIAS_TABLE)
    .upsert(rows, { onConflict: 'user_id,id' });
  if (error) throw new Error(error.message || 'Falha ao sincronizar divergências');
};

export const syncConferenciaRecebimentoRemote = async (payload, divergences = []) => {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const userId = await getCurrentUserId();
  await upsertRecord(supabase, userId, RECEBIMENTOS_TABLE, payload);
  await upsertDivergencias(supabase, userId, divergences);
};

export const syncConferenciaSaidaRemote = async (payload, divergences = []) => {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const userId = await getCurrentUserId();
  await upsertRecord(supabase, userId, SAIDAS_TABLE, payload);
  await upsertDivergencias(supabase, userId, divergences);
};

// Leitura remota das divergências do usuário (fonte de verdade, igual ao web).
// Retorna null quando não há cliente (offline) para o chamador cair no cache local.
export const listRemoteConferenciaDivergencias = async () => {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from(DIVERGENCIAS_TABLE)
    .select('payload')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    throw new Error(error.message || 'Falha ao ler divergências remotas');
  }

  return (data || []).map((row) => row?.payload).filter(Boolean);
};

// Apaga TODAS as divergências do usuário no servidor (RLS owner permite delete).
export const clearRemoteConferenciaDivergencias = async () => {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from(DIVERGENCIAS_TABLE)
    .delete()
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message || 'Falha ao limpar divergências remotas');
  }
};

// Usado pelo backfill para empurrar divergências já existentes no cache local.
export const syncConferenciaDivergenciasRemote = async (divergences = []) => {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const userId = await getCurrentUserId();
  await upsertDivergencias(supabase, userId, divergences);
};
