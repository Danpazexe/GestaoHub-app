import { STORAGE_KEYS } from '../../../constants/storage';
import { logEvent } from '../../../services/operationalEventsService';
import {
  clearRemoteConferenciaDivergencias,
  listRemoteConferenciaDivergencias,
  syncConferenciaRecebimentoRemote,
  syncConferenciaSaidaRemote,
} from './conferenciaRecordsSupabaseService';
import {
  prependConferenciaCollectionItem,
  readConferenciaCollection,
  writeConferenciaCollection,
} from '../storage/conferenciaStorage';

export const listConferenciaDivergencias = async () => {
  // Servidor é a fonte de verdade (igual ao painel web). Quando online,
  // reconcilia o cache local com o remoto — limpa divergências locais antigas
  // (de testes) que nunca subiram. Offline / erro: cai no cache local.
  try {
    const remote = await listRemoteConferenciaDivergencias();
    if (Array.isArray(remote)) {
      await writeConferenciaCollection(STORAGE_KEYS.CONFERENCIA_DIVERGENCIAS, remote, 500);
      return remote;
    }
  } catch (error) {
    console.warn('[conferencia] Leitura remota de divergências falhou; usando cache local.', error?.message || error);
  }
  return readConferenciaCollection(STORAGE_KEYS.CONFERENCIA_DIVERGENCIAS);
};

export const listConferenciaRecebimentos = async () => {
  return readConferenciaCollection(STORAGE_KEYS.CONFERENCIA_RECEBIMENTOS);
};

// Apaga as divergências no servidor (fonte de verdade) e no cache local.
// Sem o delete remoto, a próxima leitura traria tudo de volta.
export const clearConferenciaDivergencias = async () => {
  await clearRemoteConferenciaDivergencias();
  await writeConferenciaCollection(STORAGE_KEYS.CONFERENCIA_DIVERGENCIAS, [], 500);
};

export const finalizeConferenciaRecebimento = async (payload, divergences = []) => {
  const nextPayload = {
    sync_status: payload?.sync_status || 'local_only',
    pending_remote_sync: Boolean(payload?.pending_remote_sync),
    timeline: Array.isArray(payload?.timeline) ? payload.timeline : [],
    ...payload,
  };

  await prependConferenciaCollectionItem(STORAGE_KEYS.CONFERENCIA_RECEBIMENTOS, nextPayload, 300);

  if (Array.isArray(divergences) && divergences.length > 0) {
    const current = await readConferenciaCollection(STORAGE_KEYS.CONFERENCIA_DIVERGENCIAS);
    const deduped = [...divergences, ...current].slice(0, 500);
    await writeConferenciaCollection(STORAGE_KEYS.CONFERENCIA_DIVERGENCIAS, deduped, 500);
  }

  try {
    await syncConferenciaRecebimentoRemote(nextPayload, divergences);
  } catch (error) {
    console.warn('[conferencia] Sincronização remota do recebimento falhou. Mantido localmente.', error?.message || error);
  }

  logEvent({
    module: 'conferencia',
    eventType: 'conferencia_recebimento_finalizado',
    entityType: 'conferencia_recebimento',
    entityId: nextPayload.id,
    orderRef: nextPayload.invoice || null,
    payload: {
      supplier: nextPayload.supplier || null,
      items: Array.isArray(nextPayload.items) ? nextPayload.items.length : 0,
      divergences: Array.isArray(divergences) ? divergences.length : 0,
    },
  });

  return nextPayload;
};

export const finalizeConferenciaSaida = async (payload, divergences = []) => {
  await prependConferenciaCollectionItem(STORAGE_KEYS.CONFERENCIA_SAIDAS, payload, 300);

  if (Array.isArray(divergences) && divergences.length > 0) {
    const current = await readConferenciaCollection(STORAGE_KEYS.CONFERENCIA_DIVERGENCIAS);
    const deduped = [...divergences, ...current].slice(0, 500);
    await writeConferenciaCollection(STORAGE_KEYS.CONFERENCIA_DIVERGENCIAS, deduped, 500);
  }

  try {
    await syncConferenciaSaidaRemote(payload, divergences);
  } catch (error) {
    console.warn('[conferencia] Sincronização remota da saída falhou. Mantido localmente.', error?.message || error);
  }

  logEvent({
    module: 'conferencia',
    eventType: 'conferencia_saida_finalizada',
    entityType: 'conferencia_saida',
    entityId: payload.id,
    orderRef: payload.orderCode || null,
    payload: {
      separador: payload.separador || null,
      embalador: payload.embalador || null,
      items: Array.isArray(payload.items) ? payload.items.length : 0,
      divergences: Array.isArray(divergences) ? divergences.length : 0,
    },
  });

  return payload;
};
