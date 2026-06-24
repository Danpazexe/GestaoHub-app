import { getSupabaseClient } from '../../../services/supabaseClient';
import { getCurrentUserId } from '../../../services/validadeSupabaseService';
import { readStoredUserName } from '../../../services/userSessionStorageService';
import { buildConferenceResultSummary } from './conferenciaBonusQueueService';

// Fila de bônus de SAÍDA (conferência de expedição/pedido) — tabela separada da
// de entrada. O conferente bipa/digita o order_code para entrar no bônus.
const QUEUE_TABLE = 'conferencia_saida_bonus_queue';
const ITEMS_TABLE = 'conferencia_saida_bonus_queue_items';
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

  // A tabela de items é a fonte da verdade dos campos escalares; o
  // imported_payload (detail) só complementa (packaging_options) e é fallback.
  return {
    id: row.id,
    lineNumber: Number(row.line_number || detail.line_number || 0),
    code: String(row.code || detail.code || '').trim(),
    ean: String(row.ean || detail.ean || primaryPackaging.ean || '').trim(),
    dun: String(row.dun || detail.dun || primaryPackaging.dun || '').trim(),
    description: String(row.description || detail.description || '').trim(),
    unit: String(row.unit || detail.unit || primaryPackaging.label || '').trim(),
    expectedQty: Number(row.expected_qty || detail.expected_qty || 0),
    checkedQty: 0,
    packagingOptions,
    lastMeta: null,
    reads: [],
  };
};

const toQueueModel = (row = {}) => ({
  id: row.id,
  orderCode: String(row.order_code || '').trim(),
  orderKey: String(row.order_key || '').trim(),
  cargaCode: String(row.carga_code || '').trim(),
  customerName: String(row.customer_name || '').trim(),
  customerCode: String(row.customer_code || '').trim(),
  routeCode: String(row.route_code || '').trim(),
  createdAt: row.created_at || row.updated_at || new Date().toISOString(),
  lines: Number(row.item_count || 0),
  totalQuantity: Number(row.total_quantity || 0),
  status: String(row.status || 'nao_iniciado').trim(),
  assignedUserName: String(row.assigned_user_name || '').trim(),
});

export const listRemoteConferenciaSaidaBonusQueue = async () => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from(QUEUE_TABLE)
    .select('*')
    .in('status', ['nao_iniciado', 'em_conferencia', 'finalizada', 'saida_realizada'])
    .order('created_at', { ascending: false })
    .limit(80);

  if (error) {
    console.warn('Falha ao listar fila remota de bônus de saída.', error?.message || error);
    return [];
  }

  return (data || []).map(toQueueModel);
};

export const loadRemoteConferenciaSaidaBonusItems = async (queueId) => {
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

  // Casa os detalhes do payload por line_number. Linhas sem line_number válido
  // (0/ausente) são ignoradas para não colapsarem na chave 0.
  const detailsByLine = new Map();
  importedItems.forEach((item) => {
    const lineNumber = Number(item?.line_number || 0);
    if (lineNumber > 0 && !detailsByLine.has(lineNumber)) {
      detailsByLine.set(lineNumber, item);
    }
  });

  return (itemsData || []).map((row) => {
    const lineNumber = Number(row.line_number || 0);
    const detail = lineNumber > 0 ? (detailsByLine.get(lineNumber) || {}) : {};
    return toItemModel(row, detail);
  });
};

export const claimRemoteConferenciaSaidaBonus = async (queueId) => {
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
    console.warn('Falha ao assumir bônus de saída remoto.', error?.message || error);
    return false;
  }
};

export const syncRemoteConferenciaSaidaBonusProgress = async (queueId, progress = {}) => {
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

    // Mescla os contadores de progresso no imported_payload — a view admin expõe
    // checked_quantity/checked_items, e o painel desenha a barra de progressão.
    const { data: current } = await supabase
      .from(QUEUE_TABLE)
      .select('imported_payload')
      .eq('id', queueId)
      .maybeSingle();
    const base = current?.imported_payload && typeof current.imported_payload === 'object'
      ? current.imported_payload
      : {};

    const payload = hasProgress
      ? {
          status: 'em_conferencia',
          assigned_user_id: userId,
          assigned_user_name: userName || null,
          started_at: new Date().toISOString(),
          imported_payload: { ...base, checked_quantity: checkedQty, checked_items: checkedItems, progress_at: new Date().toISOString() },
        }
      : {
          status: 'nao_iniciado',
          assigned_user_id: null,
          assigned_user_name: null,
          started_at: null,
          imported_payload: { ...base, checked_quantity: 0, checked_items: 0 },
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
    console.warn('Falha ao sincronizar progresso do bônus de saída remoto.', message);
    return false;
  }
};

export const finishRemoteConferenciaSaidaBonus = async (queueId, summary = null) => {
  const supabase = getSupabaseClient();
  if (!supabase || !queueId) {
    return false;
  }

  try {
    const updates = {
      status: 'finalizada',
      finished_at: new Date().toISOString(),
    };

    // Anexa o resultado da conferência ao imported_payload (esperado x conferido
    // por item) para o admin ver porcentagem/itens/divergências no painel.
    if (summary && Array.isArray(summary.result)) {
      try {
        const { data: current } = await supabase
          .from(QUEUE_TABLE)
          .select('imported_payload')
          .eq('id', queueId)
          .maybeSingle();
        const base = current?.imported_payload && typeof current.imported_payload === 'object'
          ? current.imported_payload
          : {};
        updates.imported_payload = {
          ...base,
          conference_result: summary.result,
          checked_quantity: Number(summary.checkedQuantity || 0),
          divergence_count: Number(summary.divergenceCount || 0),
          checked_items: Number(summary.checkedItems || 0),
          conferred_at: new Date().toISOString(),
        };
      } catch (mergeError) {
        console.warn('Falha ao anexar resultado da conferência de saída; finalizando sem snapshot.', mergeError?.message || mergeError);
      }
    }

    const { error } = await supabase
      .from(QUEUE_TABLE)
      .update(updates)
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
    console.warn('Falha ao finalizar bônus de saída remoto.', message);
    return false;
  }
};

export { buildConferenceResultSummary };
