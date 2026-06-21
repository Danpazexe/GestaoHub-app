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

// Usado pelo backfill para empurrar divergências já existentes no cache local.
export const syncConferenciaDivergenciasRemote = async (divergences = []) => {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const userId = await getCurrentUserId();
  await upsertDivergencias(supabase, userId, divergences);
};
