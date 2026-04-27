import { STORAGE_KEYS } from '../../../constants/storage';
import { useConferenciaDrafts } from './useConferenciaDrafts';

const getSaidaDraftKey = (draft) => draft?.orderCode;

export const useConferenciaSaidaDrafts = () =>
  useConferenciaDrafts({
    storageKey: STORAGE_KEYS.CONFERENCIA_SAIDAS_EM_ANDAMENTO,
    getKey: getSaidaDraftKey,
    maxDrafts: 100,
    debounceMs: 650,
  });

export default useConferenciaSaidaDrafts;
