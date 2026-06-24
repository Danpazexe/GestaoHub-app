import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  readConferenciaCollection,
  writeConferenciaCollection,
} from '../storage/conferenciaStorage';

export const useConferenciaDrafts = ({
  storageKey,
  normalize = (v) => String(v || '').trim().toUpperCase(),
  getKey,
  maxDrafts = 100,
  debounceMs = 650,
} = {}) => {
  const [drafts, setDrafts] = useState([]);
  const timerRef = useRef(null);

  const mergeDraftIntoList = useCallback((list, draft) => {
    const safeList = Array.isArray(list) ? list : [];
    const key = normalize(getKey(draft));
    const index = safeList.findIndex((item) => normalize(getKey(item)) === key);
    const next = [...safeList];
    if (index >= 0) next[index] = draft;
    else next.unshift(draft);
    return next.slice(0, maxDrafts);
  }, [getKey, maxDrafts, normalize]);

  const readDrafts = useCallback(async () => {
    return readConferenciaCollection(storageKey);
  }, [storageKey]);

  const writeDrafts = useCallback(
    async (nextDrafts) => {
      const clipped = Array.isArray(nextDrafts) ? nextDrafts.slice(0, maxDrafts) : [];
      await writeConferenciaCollection(storageKey, clipped, maxDrafts);
      setDrafts(clipped);
    },
    [maxDrafts, storageKey],
  );

  const loadDrafts = useCallback(async () => {
    try {
      const list = await readDrafts();
      setDrafts(Array.isArray(list) ? list : []);
    } catch {
      setDrafts([]);
    }
  }, [readDrafts]);

  const upsertDraftDebounced = useCallback(
    (draft) => {
      if (!draft) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        try {
          const current = await readDrafts();
          const next = mergeDraftIntoList(current, draft);
          await writeDrafts(next);
        } catch {
          // ignore
        }
      }, debounceMs);
    },
    [debounceMs, mergeDraftIntoList, readDrafts, writeDrafts],
  );

  const upsertDraftImmediate = useCallback(
    async (draft) => {
      if (!draft) return;
      try {
        const next = mergeDraftIntoList(drafts, draft);
        await writeDrafts(next);
      } catch {
        // ignore
      }
    },
    [drafts, mergeDraftIntoList, writeDrafts],
  );

  const removeByKey = useCallback(
    async (keyValue) => {
      try {
        const current = await readDrafts();
        const list = Array.isArray(current) ? current : [];
        const key = normalize(keyValue);
        const next = list.filter((item) => normalize(getKey(item)) !== key);
        await writeDrafts(next);
      } catch {
        // ignore
      }
    },
    [getKey, normalize, readDrafts, writeDrafts],
  );

  const clearDrafts = useCallback(async () => {
    try {
      await writeDrafts([]);
    } catch {
      // ignore
    }
  }, [writeDrafts]);

  const findByKey = useCallback(
    async (keyValue) => {
      const key = normalize(keyValue);
      const localHit = (Array.isArray(drafts) ? drafts : []).find((item) => normalize(getKey(item)) === key);
      if (localHit) {
        return localHit;
      }
      try {
        const list = await readDrafts();
        return (Array.isArray(list) ? list : []).find((item) => normalize(getKey(item)) === key) || null;
      } catch {
        return null;
      }
    },
    [drafts, getKey, normalize, readDrafts],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return useMemo(() => ({
    drafts,
    loadDrafts,
    upsertDraftDebounced,
    upsertDraftImmediate,
    removeByKey,
    clearDrafts,
    findByKey,
  }), [
    drafts,
    loadDrafts,
    upsertDraftDebounced,
    upsertDraftImmediate,
    removeByKey,
    clearDrafts,
    findByKey,
  ]);
};
