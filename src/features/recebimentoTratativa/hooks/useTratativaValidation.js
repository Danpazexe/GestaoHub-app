import { useCallback, useMemo } from 'react';
import { hasOtherSelection } from '../constants/tratativaOptions';

export const buildTratativaValidationErrors = ({ caseForm, requiredLabels }) => {
  if (!caseForm) return {};

  const nextErrors = {};
  const snapshot = caseForm.product_snapshot || {};
  const normalizedReceived = Number(caseForm.received_quantity || 0);
  const normalizedExpected = Number(caseForm.expected_quantity || 0);
  const normalizedAffected = Number(caseForm.affected_quantity || 0);

  if (!String(caseForm.supplier_code || '').trim()) {
    nextErrors.supplier_code = `${requiredLabels.supplier_code} obrigatório.`;
  }
  if (!String(caseForm.origin_invoice_number || '').trim()) {
    nextErrors.origin_invoice_number = `${requiredLabels.origin_invoice_number} obrigatória.`;
  }
  if (!String(snapshot.codprod || '').trim()) {
    nextErrors.codprod = `${requiredLabels.codprod} obrigatório.`;
  }
  if (!String(snapshot.codauxiliar || '').trim()) {
    nextErrors.codauxiliar = `${requiredLabels.codauxiliar} obrigatório.`;
  }
  if (!String(snapshot.descricao || '').trim()) {
    nextErrors.descricao = `${requiredLabels.descricao} obrigatória.`;
  }
  if (!String(snapshot.fornecedor || '').trim()) {
    nextErrors.fornecedor = `${requiredLabels.fornecedor} obrigatório.`;
  }
  if (!String(snapshot.validade || '').trim()) {
    nextErrors.validade = `${requiredLabels.validade} obrigatória.`;
  }
  if (!Array.isArray(caseForm.reasons) || caseForm.reasons.length === 0) {
    nextErrors.reasons = 'Selecione ao menos um motivo.';
  }
  if (caseForm.resolution_type === 'devolucao' && !String(caseForm.return_invoice_number || '').trim()) {
    nextErrors.return_invoice_number = `${requiredLabels.return_invoice_number} obrigatória para devolução.`;
  }
  if (hasOtherSelection(caseForm.reasons) && !String(caseForm.observation || '').trim()) {
    nextErrors.observation = `${requiredLabels.observation} obrigatória ao usar Outro.`;
  }

  if (caseForm.occurrence_type === 'falta') {
    if (normalizedExpected <= 0) {
      nextErrors.expected_quantity = `${requiredLabels.expected_quantity} obrigatória.`;
    }
    if (normalizedReceived < 0) {
      nextErrors.received_quantity = `${requiredLabels.received_quantity} inválida.`;
    }
    if (normalizedReceived > normalizedExpected) {
      nextErrors.received_quantity = 'A quantidade recebida não pode ser maior que a esperada.';
    }
    if (normalizedExpected - normalizedReceived <= 0) {
      nextErrors.affected_quantity = 'A quantidade faltante deve ser maior que zero.';
    }
  } else {
    if (normalizedReceived <= 0) {
      nextErrors.received_quantity = `${requiredLabels.received_quantity} obrigatória.`;
    }
    if (normalizedAffected <= 0) {
      nextErrors.affected_quantity = `${requiredLabels.affected_quantity} obrigatória.`;
    }
    if (normalizedAffected > normalizedReceived) {
      nextErrors.affected_quantity = 'A quantidade com problema não pode ser maior que a quantidade recebida.';
    }
    if (
      caseForm.occurrence_type === 'avaria' &&
      !String(snapshot.imageUrl || snapshot.imagePath || '').trim()
    ) {
      nextErrors.product_image = `${requiredLabels.product_image} obrigatória para avaria.`;
    }
  }

  return nextErrors;
};

export const useTratativaValidation = ({ form, showErrors, requiredLabels }) => {
  const buildValidationErrors = useCallback(
    (caseForm) => buildTratativaValidationErrors({ caseForm, requiredLabels }),
    [requiredLabels],
  );

  const getFieldErrors = useMemo(() => {
    if (!showErrors) return {};
    return buildValidationErrors(form);
  }, [buildValidationErrors, form, showErrors]);

  const validate = useCallback(() => {
    const errors = buildValidationErrors(form);
    return Object.values(errors)[0] || null;
  }, [buildValidationErrors, form]);

  return {
    buildValidationErrors,
    getFieldErrors,
    validate,
  };
};

export default useTratativaValidation;
