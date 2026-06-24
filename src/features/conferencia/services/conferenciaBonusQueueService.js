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

  // A tabela conferencia_bonus_queue_items (row) e a fonte da verdade dos campos
  // escalares; o imported_payload (detail) so complementa (ex.: packaging_options)
  // e serve de fallback. Antes detail sobrescrevia row e um payload divergente
  // corrompia code/qty silenciosamente.
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
    .in('status', ['nao_iniciado', 'em_conferencia', 'finalizada', 'entrada_realizada'])
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

  // Casa os detalhes do payload por line_number. Linhas sem line_number valido
  // (0/ausente) sao ignoradas no merge para nao colapsarem todas na chave 0 e
  // se sobrescreverem entre si.
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

// Constrói o snapshot do resultado da conferência (esperado x conferido por item)
// para o admin ver no painel: porcentagem, itens e divergências. Guardado dentro
// de imported_payload (o conferente já tem permissão de UPDATE na própria linha),
// evitando ALTER TABLE — a view admin extrai os campos derivados.
export const buildConferenceResultSummary = (items = []) => {
  const list = Array.isArray(items) ? items : [];
  const result = list.map((item) => {
    const expectedQty = Number(item?.expectedQty || 0);
    const checkedQty = Number(item?.checkedQty || 0);
    return {
      code: String(item?.code || '').trim(),
      ean: String(item?.ean || '').trim(),
      description: String(item?.description || '').trim(),
      expectedQty,
      checkedQty,
      diff: checkedQty - expectedQty,
      packagingLabel: String(item?.lastMeta?.packagingLabel || '').trim(),
    };
  });

  const checkedQuantity = result.reduce((sum, item) => sum + item.checkedQty, 0);
  const expectedQuantity = result.reduce((sum, item) => sum + item.expectedQty, 0);
  const divergenceCount = result.filter((item) => item.diff !== 0).length;
  const checkedItems = result.filter((item) => item.checkedQty > 0).length;

  return { result, checkedQuantity, expectedQuantity, divergenceCount, checkedItems };
};

export const finishRemoteConferenciaBonus = async (queueId, summary = null) => {
  const supabase = getSupabaseClient();
  if (!supabase || !queueId) {
    return false;
  }

  try {
    const updates = {
      status: 'finalizada',
      finished_at: new Date().toISOString(),
    };

    // Anexa o resultado da conferência ao imported_payload (sem perder o payload
    // de importação). Lê o atual e mescla — caso o read falhe, finaliza mesmo
    // assim (status é o que importa para sair da fila do conferente).
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
        console.warn('Falha ao anexar resultado da conferência; finalizando sem snapshot.', mergeError?.message || mergeError);
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
    console.warn('Falha ao finalizar bonus remoto.', message);
    return false;
  }
};
