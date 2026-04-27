import { getSupabaseClient } from '../../../services/supabaseClient';
import { getCurrentUserId } from '../../../services/validadeSupabaseService';
import { readStoredUserName } from '../../../services/userSessionStorageService';

const QUEUE_TABLE = 'conferencia_bonus_queue';
const ITEMS_TABLE = 'conferencia_bonus_queue_items';
const AUTH_ERROR_MESSAGE = 'Usuário não autenticado no Supabase';

const sanitizePackagingOption = (option = {}, fallback = {}) => {
  const label = String(option.label || fallback.label || 'UN').trim() || 'UN';
  const factor = Math.max(1, Number(option.factor || fallback.factor || 1) || 1);
  const ean = String(option.ean || fallback.ean || '').trim();
  const dun = String(option.dun || fallback.dun || '').trim();

  return {
    id: String(option.id || fallback.id || label.toLowerCase()),
    label,
    factor,
    ean,
    dun,
  };
};

const buildPackagingOptions = (row = {}, detail = {}) => {
  const fallback = sanitizePackagingOption({}, {
    id: 'un',
    label: String(row.unit || 'UN').trim() || 'UN',
    factor: 1,
    ean: String(row.ean || '').trim(),
    dun: String(row.dun || '').trim(),
  });

  const rawOptions = Array.isArray(detail.packaging_options) ? detail.packaging_options : [];
  const options = rawOptions
    .map((option) => sanitizePackagingOption(option, fallback))
    .filter((option, index, list) => list.findIndex((current) => current.id === option.id) === index);

  return options.length > 0 ? options : [fallback];
};

const toItemModel = (row = {}, detail = {}) => {
  const packagingOptions = buildPackagingOptions(row, detail);
  const primaryPackaging = packagingOptions[0] || sanitizePackagingOption();

  return {
    id: row.id,
    lineNumber: Number(detail.line_number || row.line_number || 0),
    code: String(detail.code || row.code || '').trim(),
    ean: String(detail.ean || row.ean || primaryPackaging.ean || '').trim(),
    dun: String(detail.dun || row.dun || primaryPackaging.dun || '').trim(),
    description: String(detail.description || row.description || '').trim(),
    unit: String(detail.unit || row.unit || primaryPackaging.label || '').trim(),
    expectedQty: Number(detail.expected_qty || row.expected_qty || 0),
    checkedQty: 0,
    packagingOptions,
    lastMeta: null,
    reads: [],
  };
};

const toQueueModel = (row = {}) => ({
  id: row.id,
  supplierCode: String(row.supplier_code || '').trim(),
  supplierName: String(row.supplier_name || '').trim(),
  invoice: String(row.invoice_number || '').trim(),
  invoiceKey: String(row.invoice_key || '').trim(),
  createdAt: row.created_at || row.updated_at || new Date().toISOString(),
  issuedAt: row.issued_at || null,
  lines: Number(row.item_count || 0),
  totalQuantity: Number(row.total_quantity || 0),
  status: String(row.status || 'nao_iniciado').trim(),
  assignedUserName: String(row.assigned_user_name || '').trim(),
});

export const listRemoteConferenciaBonusQueue = async () => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from(QUEUE_TABLE)
    .select('*')
    .in('status', ['nao_iniciado', 'em_conferencia', 'finalizada'])
    .order('created_at', { ascending: false })
    .limit(80);

  if (error) {
    console.warn('Falha ao listar fila remota de bonus.', error?.message || error);
    return [];
  }

  return (data || []).map(toQueueModel);
};

export const loadRemoteConferenciaBonusItems = async (queueId) => {
  const supabase = getSupabaseClient();
  if (!supabase || !queueId) {
    return [];
  }

  const [{ data: itemsData, error: itemsError }, { data: queueData, error: queueError }] = await Promise.all([
    supabase
      .from(ITEMS_TABLE)
      .select('*')
      .eq('queue_id', queueId)
      .order('line_number', { ascending: true }),
    supabase
      .from(QUEUE_TABLE)
      .select('imported_payload')
      .eq('id', queueId)
      .maybeSingle(),
  ]);

  if (itemsError) {
    throw itemsError;
  }

  if (queueError) {
    throw queueError;
  }

  const importedItems = Array.isArray(queueData?.imported_payload?.items)
    ? queueData.imported_payload.items
    : [];

  const detailsByLine = new Map(
    importedItems.map((item) => [Number(item?.line_number || 0), item]),
  );

  return (itemsData || []).map((row) => {
    const detail = detailsByLine.get(Number(row.line_number || 0)) || {};
    return toItemModel(row, detail);
  });
};

export const claimRemoteConferenciaBonus = async (queueId) => {
  const supabase = getSupabaseClient();
  if (!supabase || !queueId) {
    return false;
  }

  try {
    const [userId, userName] = await Promise.all([
      getCurrentUserId(),
      readStoredUserName(''),
    ]);

    const { error } = await supabase
      .from(QUEUE_TABLE)
      .update({
        status: 'em_conferencia',
        assigned_user_id: userId,
        assigned_user_name: userName || null,
        started_at: new Date().toISOString(),
      })
      .eq('id', queueId);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.warn('Falha ao assumir bonus remoto.', error?.message || error);
    return false;
  }
};

export const syncRemoteConferenciaBonusProgress = async (queueId, progress = {}) => {
  const supabase = getSupabaseClient();
  if (!supabase || !queueId) {
    return false;
  }

  const checkedQty = Math.max(0, Number(progress.checkedQty || 0));
  const checkedItems = Math.max(0, Number(progress.checkedItems || 0));
  const hasProgress = checkedQty > 0 || checkedItems > 0;

  try {
    const [userId, userName] = await Promise.all([
      getCurrentUserId(),
      readStoredUserName(''),
    ]);

    const payload = hasProgress
      ? {
          status: 'em_conferencia',
          assigned_user_id: userId,
          assigned_user_name: userName || null,
          started_at: new Date().toISOString(),
        }
      : {
          status: 'nao_iniciado',
          assigned_user_id: null,
          assigned_user_name: null,
          started_at: null,
        };

    const { error } = await supabase
      .from(QUEUE_TABLE)
      .update(payload)
      .eq('id', queueId);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    const message = String(error?.message || error || '');
    if (message.includes(AUTH_ERROR_MESSAGE)) {
      return false;
    }
    console.warn('Falha ao sincronizar progresso do bonus remoto.', message);
    return false;
  }
};

export const finishRemoteConferenciaBonus = async (queueId) => {
  const supabase = getSupabaseClient();
  if (!supabase || !queueId) {
    return false;
  }

  try {
    const { error } = await supabase
      .from(QUEUE_TABLE)
      .update({
        status: 'finalizada',
        finished_at: new Date().toISOString(),
      })
      .eq('id', queueId);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    const message = String(error?.message || error || '');
    if (message.includes(AUTH_ERROR_MESSAGE)) {
      return false;
    }
    console.warn('Falha ao finalizar bonus remoto.', message);
    return false;
  }
};
