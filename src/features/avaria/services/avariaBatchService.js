import { logEvent } from '../../../services/operationalEventsService';
import {
  deleteAvariaBatchRemote,
  deleteConcludedAvariaBatchesRemote,
  upsertAvariaBatchRemote,
} from './avariaSupabaseService';
import {
  readAvariaBatches,
  writeAvariaBatches,
} from '../storage/avariaBatchStorage';

export const listAvariaBatches = async () => {
  return readAvariaBatches();
};

export const loadAvariaBatchById = async (batchId) => {
  const batches = await readAvariaBatches();
  return batches.find((item) => item?.id === batchId) || null;
};

export const listOpenAvariaBatches = async () => {
  const batches = await readAvariaBatches();
  return batches
    .filter((item) => item?.status === 'open')
    .sort((a, b) => new Date(b?.updatedAt || 0) - new Date(a?.updatedAt || 0));
};

export const listConcludedAvariaBatches = async () => {
  const batches = await readAvariaBatches();
  return batches
    .filter((item) => item?.status === 'concluded')
    .sort((a, b) => new Date(b?.updatedAt || 0) - new Date(a?.updatedAt || 0));
};

export const saveAvariaBatch = async (batchData) => {
  const batches = await readAvariaBatches();
  const nextBatches = batches.some((item) => item?.id === batchData.id)
    ? batches.map((item) => (item?.id === batchData.id ? batchData : item))
    : [...batches, batchData];

  await writeAvariaBatches(nextBatches);

  // Write-through remoto (best-effort; o local-first acima já garantiu a gravação).
  try {
    await upsertAvariaBatchRemote(batchData);
  } catch (error) {
    console.warn('[avaria] Sincronização remota do lote falhou. Mantido localmente.', error?.message || error);
  }

  logEvent({
    module: 'avaria',
    eventType: batchData.status === 'concluded' ? 'avaria_batch_concluded' : 'avaria_batch_saved',
    entityType: 'avaria_batch',
    entityId: batchData.id,
    batchRef: batchData.id,
    payload: {
      status: batchData.status,
      items: Array.isArray(batchData.items) ? batchData.items.length : 0,
      bonus_type: batchData.bonusType || null,
    },
  });

  return batchData;
};

export const deleteAvariaBatch = async (batchId) => {
  const batches = await readAvariaBatches();
  const filtered = batches.filter((item) => item?.id !== batchId);
  await writeAvariaBatches(filtered);

  try {
    await deleteAvariaBatchRemote(batchId);
  } catch (error) {
    console.warn('[avaria] Remoção remota do lote falhou.', error?.message || error);
  }

  return filtered;
};

export const clearConcludedAvariaBatches = async () => {
  const batches = await readAvariaBatches();
  const filtered = batches.filter((item) => item?.status !== 'concluded');
  await writeAvariaBatches(filtered);

  try {
    await deleteConcludedAvariaBatchesRemote();
  } catch (error) {
    console.warn('[avaria] Limpeza remota de concluídos falhou.', error?.message || error);
  }

  return filtered;
};
