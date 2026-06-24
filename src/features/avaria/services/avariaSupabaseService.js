import { getSupabaseClient } from '../../../services/supabaseClient';
import { getCurrentUserId } from '../../../services/validadeSupabaseService';

const BATCHES_TABLE = 'avaria_batches';
const ITEMS_TABLE = 'avaria_items';

const mapBatchToRemote = (batch, userId) => ({
  id: String(batch.id),
  user_id: userId,
  supplier: batch.supplierName || null,
  bonus_type: batch.bonusType || null,
  notes: batch.notes || null,
  status: batch.status === 'concluded' ? 'concluded' : 'open',
});

const mapItemToRemote = (item, batch, userId) => ({
  id: String(item.id),
  batch_id: String(batch.id),
  user_id: userId,
  descricao: item.descricao || item.description || '',
  codprod: item.codprod || null,
  // O modelo local usa `quantity`; a coluna remota é `quantidade`.
  quantidade: Number.parseInt(item.quantity ?? item.quantidade ?? 0, 10) || 0,
  lote: item.lote || null,
  damage_type: item.damageType || item.damage_type || null,
  resolution_type: item.resolutionType || item.resolution_type || null,
  // Itens não têm bônus próprio: denormaliza do lote.
  bonus_type: batch.bonusType || null,
  status: batch.status === 'concluded' ? 'resolved' : 'damaged',
});

// Upsert do lote + itens, removendo itens que foram apagados localmente.
export const upsertAvariaBatchRemote = async (batch) => {
  const supabase = getSupabaseClient();
  if (!supabase || !batch?.id) return null;

  const userId = await getCurrentUserId(); // lança se não autenticado → o chamador engole

  const { error: batchError } = await supabase
    .from(BATCHES_TABLE)
    .upsert([mapBatchToRemote(batch, userId)], { onConflict: 'user_id,id' });
  if (batchError) throw new Error(batchError.message || 'Falha ao sincronizar lote de avaria');

  const items = Array.isArray(batch.items) ? batch.items.filter((item) => item?.id) : [];

  if (items.length > 0) {
    const { error: itemsError } = await supabase
      .from(ITEMS_TABLE)
      .upsert(items.map((item) => mapItemToRemote(item, batch, userId)), { onConflict: 'user_id,id' });
    if (itemsError) throw new Error(itemsError.message || 'Falha ao sincronizar itens de avaria');
  }

  // Remove órfãos: itens remotos do lote que não estão mais na lista local.
  // Em vez de montar um filtro `not in (...)` por string (frágil e perigoso se um id
  // tiver vírgula/aspas — DELETE poderia atingir linhas erradas), lemos os ids remotos
  // e apagamos APENAS os que sumiram, com `.in()` nativo (escapado pelo supabase-js).
  const keepIds = new Set(items.map((item) => String(item.id)));
  const { data: remoteItems, error: listError } = await supabase
    .from(ITEMS_TABLE)
    .select('id')
    .eq('user_id', userId)
    .eq('batch_id', String(batch.id));
  if (listError) throw new Error(listError.message || 'Falha ao listar itens de avaria');

  const orphanIds = (remoteItems || [])
    .map((row) => String(row.id))
    .filter((id) => !keepIds.has(id));

  if (orphanIds.length > 0) {
    const { error: orphanError } = await supabase
      .from(ITEMS_TABLE)
      .delete()
      .eq('user_id', userId)
      .eq('batch_id', String(batch.id))
      .in('id', orphanIds);
    if (orphanError) throw new Error(orphanError.message || 'Falha ao limpar itens de avaria removidos');
  }

  return batch;
};

export const deleteAvariaBatchRemote = async (batchId) => {
  const supabase = getSupabaseClient();
  if (!supabase || !batchId) return;

  const userId = await getCurrentUserId();
  // FK on delete cascade remove os itens automaticamente.
  const { error } = await supabase
    .from(BATCHES_TABLE)
    .delete()
    .eq('user_id', userId)
    .eq('id', String(batchId));
  if (error) throw new Error(error.message || 'Falha ao remover lote de avaria remoto');
};

export const deleteConcludedAvariaBatchesRemote = async () => {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from(BATCHES_TABLE)
    .delete()
    .eq('user_id', userId)
    .eq('status', 'concluded');
  if (error) throw new Error(error.message || 'Falha ao limpar lotes concluídos remotos');
};
