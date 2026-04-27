import { STORAGE_KEYS } from '../../../constants/storage';
import { useConferenciaDrafts } from './useConferenciaDrafts';

const getRecebimentoDraftKey = (draft) => draft?.invoice;

export const useConferenciaRecebimentoDrafts = () =>
  useConferenciaDrafts({
    storageKey: STORAGE_KEYS.CONFERENCIA_RECEBIMENTOS_EM_ANDAMENTO,
    getKey: getRecebimentoDraftKey,
    maxDrafts: 100,
    debounceMs: 650,
  });

export default useConferenciaRecebimentoDrafts;
