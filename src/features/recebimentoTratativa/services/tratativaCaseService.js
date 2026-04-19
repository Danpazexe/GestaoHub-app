import { getSupabaseClient } from '../../../services/supabaseClient';
import { getCurrentUserId } from '../../../services/validadeSupabaseService';
import {
  mapCaseToRemote,
  mapRemoteCaseToModel,
  normalizeTratativaCase,
} from '../mappers/tratativaCaseMapper';
import {
  ACTION_OPTIONS,
  TRATATIVA_STATUS,
} from '../constants/tratativaOptions';
import {
  readTratativaCasesCache,
  writeTratativaCasesCache,
} from '../storage/tratativaCaseStorage';

const TABLE = 'recebimento_treatment_cases';

const formatTratativaNumber = (supplierCode, sequenceNumber) =>
  `TR ${String(supplierCode).trim()} - ${String(sequenceNumber).padStart(4, '0')}`;

const readSequenceBaseCases = async () => {
  const cachedCases = await readTratativaCasesCache();
  const supabase = getSupabaseClient();
  if (!supabase) {
    return cachedCases;
  }

  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from(TABLE)
      .select('id, supplier_code, doc_sequence_number, doc_number, updated_at')
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    const remoteCases = (data || []).map((item) => mapRemoteCaseToModel(item));
    const mergedMap = new Map(remoteCases.map((item) => [item.id, item]));

    cachedCases
      .filter((item) => item.pending_remote_sync)
      .forEach((item) => {
        const existing = mergedMap.get(item.id);
        if (!existing || new Date(item.updated_at) >= new Date(existing.updated_at || 0)) {
          mergedMap.set(item.id, item);
        }
      });

    return [...mergedMap.values()];
  } catch (error) {
    console.warn('Falha ao consultar sequencial remoto. Usando cache local.', error?.message || error);
    return cachedCases;
  }
};

const getNextSequenceForSupplier = async (supplierCode, currentCaseId = null) => {
  const normalizedSupplierCode = String(supplierCode || '').trim();
  const cases = await readSequenceBaseCases();

  const maxSequence = cases.reduce((highest, item) => {
    if (item.id === currentCaseId) {
      return highest;
    }
    if (String(item.supplier_code || '').trim() !== normalizedSupplierCode) {
      return highest;
    }

    if (Number(item.doc_sequence_number || 0) > highest) {
      return Number(item.doc_sequence_number || 0);
    }

    const match = String(item.doc_number || '').match(/-\s*(\d{1,})$/);
    const parsed = match ? Number(match[1]) : 0;
    return parsed > highest ? parsed : highest;
  }, 0);

  return maxSequence + 1;
};

export const listTratativaCases = async () => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return readTratativaCasesCache();
  }

  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const mapped = (data || []).map((item) => ({
      ...mapRemoteCaseToModel(item),
      pending_remote_sync: false,
    }));
    const cachedCases = await readTratativaCasesCache();
    const pendingCases = cachedCases.filter((item) => item.pending_remote_sync);
    const mergedMap = new Map(mapped.map((item) => [item.id, item]));

    pendingCases.forEach((item) => {
      const remoteVersion = mergedMap.get(item.id);
      if (!remoteVersion || new Date(item.updated_at) >= new Date(remoteVersion.updated_at)) {
        mergedMap.set(item.id, item);
      }
    });

    const merged = [...mergedMap.values()].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    await writeTratativaCasesCache(merged);
    return merged;
  } catch (error) {
    console.warn('Falha ao carregar tratativas remotas. Usando cache local.', error?.message || error);
    return readTratativaCasesCache();
  }
};

export const getTratativaCaseById = async (caseId) => {
  const cases = await listTratativaCases();
  return cases.find((item) => item.id === String(caseId)) || null;
};

export const buildStandaloneCaseDraft = (prefill = {}) =>
  normalizeTratativaCase({
    resolution_type: ACTION_OPTIONS[0].key,
    occurrence_type: 'avaria',
    affected_quantity: Number(prefill?.affected_quantity ?? 0),
    received_quantity: Number(prefill?.received_quantity ?? prefill?.product_snapshot?.quantidade_original ?? 0),
    expected_quantity: Number(prefill?.expected_quantity ?? 0),
    opened_at: new Date().toISOString(),
    status: TRATATIVA_STATUS.ABERTA,
    ...prefill,
  });

const upsertTratativaCaseRemote = async (caseItem) => {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const userId = await getCurrentUserId();
  const payload = mapCaseToRemote(caseItem, userId);
  const { data, error } = await supabase
    .from(TABLE)
    .upsert([payload], { onConflict: 'user_id,id' })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return mapRemoteCaseToModel(data);
};

export const saveTratativaCase = async (caseInput) => {
  let normalized = normalizeTratativaCase({
    ...caseInput,
    updated_at: new Date().toISOString(),
  });

  const cachedCases = await readTratativaCasesCache();
  const existingCase = cachedCases.find((item) => item.id === normalized.id);

  if (existingCase?.doc_number) {
    normalized = normalizeTratativaCase({
      ...normalized,
      supplier_code: existingCase.supplier_code || normalized.supplier_code,
      doc_sequence_number: existingCase.doc_sequence_number || normalized.doc_sequence_number,
      doc_number: existingCase.doc_number,
    });
  } else if (!normalized.doc_number && normalized.supplier_code) {
    const nextSequence = await getNextSequenceForSupplier(normalized.supplier_code, normalized.id);
    normalized = normalizeTratativaCase({
      ...normalized,
      doc_sequence_number: nextSequence,
      doc_number: formatTratativaNumber(normalized.supplier_code, nextSequence),
    });
  }

  const nextCase = {
    ...existingCase,
    ...normalized,
    product_snapshot: {
      ...(existingCase?.product_snapshot || {}),
      ...(normalized.product_snapshot || {}),
    },
    pending_remote_sync: true,
  };

  if (nextCase.status === TRATATIVA_STATUS.ENCERRADA && !nextCase.closed_at) {
    nextCase.closed_at = new Date().toISOString();
  }

  const mergedCases = [nextCase, ...cachedCases.filter((item) => item.id !== nextCase.id)]
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  await writeTratativaCasesCache(mergedCases);

  let remoteCase = null;
  try {
    remoteCase = await upsertTratativaCaseRemote(nextCase);
  } catch (error) {
    console.warn('Falha ao sincronizar tratativa no Supabase. Mantendo cache local.', error?.message || error);
  }

  const persistedCase = remoteCase
    ? {
      ...remoteCase,
      pending_remote_sync: false,
    }
    : nextCase;

  const reconciledCases = [
    persistedCase,
    ...mergedCases.filter((item) => item.id !== persistedCase.id),
  ].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  await writeTratativaCasesCache(reconciledCases);

  return {
    caseItem: persistedCase,
    remoteSynced: Boolean(remoteCase),
  };
};

export const updateTratativaStatus = async (caseItem, status) => {
  return saveTratativaCase({
    ...caseItem,
    status,
    status_updated_at: new Date().toISOString(),
    closed_at: status === TRATATIVA_STATUS.ENCERRADA
      ? (caseItem.closed_at || new Date().toISOString())
      : caseItem.closed_at,
  });
};
