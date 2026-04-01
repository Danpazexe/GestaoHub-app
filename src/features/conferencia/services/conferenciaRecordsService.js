import { STORAGE_KEYS } from '../../../constants/storage';
import {
  prependConferenciaCollectionItem,
  readConferenciaCollection,
  writeConferenciaCollection,
} from '../storage/conferenciaStorage';

export const listConferenciaDivergencias = async () => {
  return readConferenciaCollection(STORAGE_KEYS.CONFERENCIA_DIVERGENCIAS);
};

export const finalizeConferenciaRecebimento = async (payload, divergences = []) => {
  await prependConferenciaCollectionItem(STORAGE_KEYS.CONFERENCIA_RECEBIMENTOS, payload, 300);

  if (Array.isArray(divergences) && divergences.length > 0) {
    const current = await readConferenciaCollection(STORAGE_KEYS.CONFERENCIA_DIVERGENCIAS);
    const deduped = [...divergences, ...current].slice(0, 500);
    await writeConferenciaCollection(STORAGE_KEYS.CONFERENCIA_DIVERGENCIAS, deduped, 500);
  }

  return payload;
};

export const finalizeConferenciaSaida = async (payload, divergences = []) => {
  await prependConferenciaCollectionItem(STORAGE_KEYS.CONFERENCIA_SAIDAS, payload, 300);

  if (Array.isArray(divergences) && divergences.length > 0) {
    const current = await readConferenciaCollection(STORAGE_KEYS.CONFERENCIA_DIVERGENCIAS);
    const deduped = [...divergences, ...current].slice(0, 500);
    await writeConferenciaCollection(STORAGE_KEYS.CONFERENCIA_DIVERGENCIAS, deduped, 500);
  }

  return payload;
};
