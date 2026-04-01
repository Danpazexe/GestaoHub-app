import { STORAGE_KEYS } from '../../../constants/storage';
import { useConferenciaDrafts } from './useConferenciaDrafts';

export const useConferenciaRecebimentoDrafts = () =>
  useConferenciaDrafts({
    storageKey: STORAGE_KEYS.CONFERENCIA_RECEBIMENTOS_EM_ANDAMENTO,
    getKey: (draft) => draft?.invoice,
    maxDrafts: 100,
    debounceMs: 650,
  });

export default useConferenciaRecebimentoDrafts;
