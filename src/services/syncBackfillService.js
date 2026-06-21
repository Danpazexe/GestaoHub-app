import { STORAGE_KEYS } from '../constants/storage';
import { upsertAvariaBatchRemote } from '../features/avaria/services/avariaSupabaseService';
import { readAvariaBatches } from '../features/avaria/storage/avariaBatchStorage';
import {
  syncConferenciaDivergenciasRemote,
  syncConferenciaRecebimentoRemote,
  syncConferenciaSaidaRemote,
} from '../features/conferencia/services/conferenciaRecordsSupabaseService';
import { readConferenciaCollection } from '../features/conferencia/storage/conferenciaStorage';
import { upsertTratativaCaseRemote } from '../features/recebimentoTratativa/services/tratativaCaseService';
import { readTratativaCasesCache } from '../features/recebimentoTratativa/storage/tratativaCaseStorage';
import { upsertUserSettingsRemote } from '../features/settings/services/userSettingsRemoteService';
import { readValidadeProductsCache } from '../features/validade/storage/validadeProductsStorage';
import { readStringStorage, writeStringStorage } from './appStorageService';
import { getCurrentUserId } from './validadeSupabaseService';
import { upsertValidadeProduct } from './validadeSupabaseService';

const BACKFILL_DONE_KEY = 'sync_backfill_done_v1';

let inFlight = false;
let settled = false; // curto-circuito em memória após concluir/confirmar

const pushEach = async (items, pushFn, label, summary) => {
  for (const item of Array.isArray(items) ? items : []) {
    try {
      await pushFn(item);
      summary.counts[label] = (summary.counts[label] || 0) + 1;
    } catch (error) {
      summary.errors.push(`${label}: ${error?.message || error}`);
    }
  }
};

// Empurra para o Supabase tudo que já existe no AsyncStorage. Idempotente (upserts).
export const runFullSyncBackfill = async () => {
  const summary = { counts: {}, errors: [] };

  // Validade
  await pushEach(await readValidadeProductsCache(), upsertValidadeProduct, 'validade', summary);

  // Tratativas
  await pushEach(await readTratativaCasesCache(), upsertTratativaCaseRemote, 'tratativas', summary);

  // Avaria
  await pushEach(await readAvariaBatches(), upsertAvariaBatchRemote, 'avaria', summary);

  // Conferência (recebimentos / saídas)
  await pushEach(
    await readConferenciaCollection(STORAGE_KEYS.CONFERENCIA_RECEBIMENTOS),
    (payload) => syncConferenciaRecebimentoRemote(payload, []),
    'conferencia_recebimentos',
    summary,
  );
  await pushEach(
    await readConferenciaCollection(STORAGE_KEYS.CONFERENCIA_SAIDAS),
    (payload) => syncConferenciaSaidaRemote(payload, []),
    'conferencia_saidas',
    summary,
  );

  // Conferência (divergências) — em lote
  try {
    const divergencias = await readConferenciaCollection(STORAGE_KEYS.CONFERENCIA_DIVERGENCIAS);
    if (Array.isArray(divergencias) && divergencias.length > 0) {
      await syncConferenciaDivergenciasRemote(divergencias);
      summary.counts.conferencia_divergencias = divergencias.length;
    }
  } catch (error) {
    summary.errors.push(`conferencia_divergencias: ${error?.message || error}`);
  }

  // Configurações
  try {
    await upsertUserSettingsRemote();
    summary.counts.settings = 1;
  } catch (error) {
    summary.errors.push(`settings: ${error?.message || error}`);
  }

  return summary;
};

// Roda o backfill no máximo uma vez por dispositivo, quando houver usuário autenticado.
// Best-effort: enquanto não houver login, apenas reagenda para a próxima tentativa.
export const maybeRunInitialSyncBackfill = async () => {
  if (settled || inFlight) return null;

  const done = await readStringStorage(BACKFILL_DONE_KEY, '');
  if (done === 'true') {
    settled = true;
    return null;
  }

  let userId = null;
  try {
    userId = await getCurrentUserId();
  } catch {
    return null; // ainda sem login → tenta de novo numa próxima navegação/launch
  }
  if (!userId) return null;

  inFlight = true;
  try {
    const summary = await runFullSyncBackfill();
    // Só marca como concluído se NÃO houve erros; senão, tenta de novo na próxima
    // abertura (os upserts são idempotentes, então repetir é seguro).
    if (Array.isArray(summary.errors) && summary.errors.length === 0) {
      await writeStringStorage(BACKFILL_DONE_KEY, 'true');
      settled = true;
      console.log('[backfill] Sincronização inicial concluída.', summary);
    } else {
      console.warn('[backfill] Concluída com erros — tentará novamente na próxima abertura.', summary);
    }
    return summary;
  } catch (error) {
    console.warn('[backfill] Falha na sincronização inicial. Tentará novamente.', error?.message || error);
    return null;
  } finally {
    inFlight = false;
  }
};
