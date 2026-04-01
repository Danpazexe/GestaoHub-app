import {
  ACTION_OPTIONS,
  OCCURRENCE_OPTIONS,
  TRATATIVA_STATUS,
  joinSelectionValues,
  normalizeSelectionValues,
} from '../constants/tratativaOptions';

const DEFAULT_SNAPSHOT = {
  codprod: '',
  codauxiliar: '',
  descricao: '',
  fornecedor: '',
  quantidade_original: 0,
  imageUrl: '',
  imagePath: '',
  lote: '',
  validade: '',
};

export const buildSnapshotFromProduct = (product = {}) => ({
  ...DEFAULT_SNAPSHOT,
  codprod: String(product.codprod || ''),
  codauxiliar: String(product.codauxiliar || ''),
  descricao: String(product.descricao || ''),
  fornecedor: String(product.fornecedor || ''),
  quantidade_original: Number(product.quantidade_original ?? product.quantidade ?? 0),
  imageUrl: String(product.imageUrl || product.foto || ''),
  imagePath: String(product.imagePath || ''),
  lote: String(product.lote || ''),
  validade: String(product.validade || ''),
});

export const normalizeTratativaCase = (caseInput = {}) => {
  const createdAt = caseInput.created_at || new Date().toISOString();
  const legacyResolutionMap = {
    recolhimento: 'devolucao',
    reposicao: 'troca',
    abatimento: 'tratativa',
  };
  const resolutionTypeSeed = legacyResolutionMap[caseInput.resolution_type || caseInput.inventory_action_type]
    || caseInput.resolution_type
    || caseInput.inventory_action_type;
  const reasons = normalizeSelectionValues(caseInput.reasons, caseInput.reason);
  const inferredOccurrenceType = reasons.some((item) => item.toLowerCase().includes('falta'))
    ? 'falta'
    : undefined;
  const resolutionType = ACTION_OPTIONS.some((item) => item.key === resolutionTypeSeed)
    ? resolutionTypeSeed
    : ACTION_OPTIONS[0].key;
  const occurrenceTypeSeed = caseInput.occurrence_type || inferredOccurrenceType;
  const occurrenceType = OCCURRENCE_OPTIONS.some((item) => item.key === occurrenceTypeSeed)
    ? occurrenceTypeSeed
    : OCCURRENCE_OPTIONS[0].key;
  const affectedQuantity = caseInput.affected_quantity ?? caseInput.inventory_quantity;
  const handlingMethods = normalizeSelectionValues(
    caseInput.handling_methods,
    caseInput.handling_method,
  );
  const supplierCode = String(caseInput.supplier_code || '').trim();
  const docSequenceNumber = Number(caseInput.doc_sequence_number || 0) || null;
  const receivedQuantity = Number(
    caseInput.received_quantity
    ?? caseInput?.product_snapshot?.quantidade_original
    ?? 0,
  ) || 0;
  const expectedQuantity = Number(
    caseInput.expected_quantity
    ?? (occurrenceType === 'falta' ? receivedQuantity + Number(affectedQuantity || 0) : 0),
  ) || 0;
  const normalizedValidity = String(caseInput?.product_snapshot?.validade || caseInput.validade || '');

  return {
    id: String(caseInput.id || Date.now()),
    user_id: caseInput.user_id || null,
    doc_number: String(caseInput.doc_number || ''),
    supplier_code: supplierCode,
    doc_sequence_number: docSequenceNumber,
    origin_invoice_number: String(caseInput.origin_invoice_number || ''),
    return_invoice_number: String(caseInput.return_invoice_number || ''),
    status: caseInput.status || TRATATIVA_STATUS.ABERTA,
    status_updated_at: caseInput.status_updated_at || createdAt,
    occurrence_type: occurrenceType,
    resolution_type: resolutionType,
    affected_quantity: Number(affectedQuantity || 0),
    expected_quantity: expectedQuantity,
    received_quantity: receivedQuantity,
    product_snapshot: {
      ...DEFAULT_SNAPSHOT,
      ...(caseInput.product_snapshot || {}),
      quantidade_original: Number(caseInput?.product_snapshot?.quantidade_original || 0),
      validade: normalizedValidity,
    },
    opened_at: caseInput.opened_at || createdAt,
    started_at: caseInput.started_at || null,
    expected_end_at: caseInput.expected_end_at || null,
    closed_at: caseInput.closed_at || null,
    reasons,
    handling_methods: handlingMethods,
    reason: joinSelectionValues(reasons),
    handling_method: joinSelectionValues(handlingMethods),
    observation: String(caseInput.observation || ''),
    authorized_by: String(caseInput.authorized_by || ''),
    collected_by: String(caseInput.collected_by || ''),
    pending_remote_sync: Boolean(caseInput.pending_remote_sync),
    created_at: createdAt,
    updated_at: caseInput.updated_at || createdAt,
  };
};

export const mapRemoteCaseToModel = (row = {}) =>
  normalizeTratativaCase({
    id: row.id,
    user_id: row.user_id,
    doc_number: row.doc_number,
    supplier_code: row.supplier_code,
    doc_sequence_number: row.doc_sequence_number,
    origin_invoice_number: row.origin_invoice_number,
    return_invoice_number: row.return_invoice_number,
    status: row.status,
    status_updated_at: row.status_updated_at,
    occurrence_type: row.occurrence_type,
    resolution_type: row.resolution_type || row.inventory_action_type,
    affected_quantity: row.affected_quantity ?? row.inventory_quantity,
    expected_quantity: row.expected_quantity,
    received_quantity: row.received_quantity,
    product_snapshot: row.product_snapshot,
    opened_at: row.opened_at,
    started_at: row.started_at,
    expected_end_at: row.expected_end_at,
    closed_at: row.closed_at,
    reasons: row.reasons,
    handling_methods: row.handling_methods,
    reason: row.reason,
    handling_method: row.handling_method,
    observation: row.observation,
    authorized_by: row.authorized_by,
    collected_by: row.collected_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });

export const mapCaseToRemote = (caseItem = {}, userId) => {
  const normalized = normalizeTratativaCase({
    ...caseItem,
    user_id: userId || caseItem.user_id || null,
  });

  return {
    id: normalized.id,
    user_id: normalized.user_id,
    doc_number: normalized.doc_number,
    supplier_code: normalized.supplier_code || null,
    doc_sequence_number: normalized.doc_sequence_number,
    origin_invoice_number: normalized.origin_invoice_number || null,
    return_invoice_number: normalized.return_invoice_number || null,
    status: normalized.status,
    status_updated_at: normalized.status_updated_at,
    occurrence_type: normalized.occurrence_type,
    resolution_type: normalized.resolution_type,
    affected_quantity: normalized.affected_quantity,
    expected_quantity: normalized.expected_quantity,
    received_quantity: normalized.received_quantity,
    product_snapshot: normalized.product_snapshot,
    opened_at: normalized.opened_at,
    started_at: normalized.started_at,
    expected_end_at: normalized.expected_end_at,
    closed_at: normalized.closed_at,
    reasons: normalized.reasons,
    handling_methods: normalized.handling_methods,
    reason: normalized.reason || null,
    handling_method: normalized.handling_method || null,
    observation: normalized.observation || null,
    authorized_by: normalized.authorized_by || null,
    collected_by: normalized.collected_by || null,
    created_at: normalized.created_at,
    updated_at: new Date().toISOString(),
  };
};
