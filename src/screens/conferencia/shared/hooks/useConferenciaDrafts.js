import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useConferenciaDrafts = ({
  storageKey,
  normalize = (v) => String(v || '').trim().toUpperCase(),
  getKey,
  maxDrafts = 100,
  debounceMs = 650,
} = {}) => {
  const [drafts, setDrafts] = useState([]);
  const timerRef = useRef(null);

  const readDrafts = useCallback(async () => {
    const raw = await AsyncStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : [];
  }, [storageKey]);

  const writeDrafts = useCallback(
    async (nextDrafts) => {
      const clipped = Array.isArray(nextDrafts) ? nextDrafts.slice(0, maxDrafts) : [];
      await AsyncStorage.setItem(storageKey, JSON.stringify(clipped));
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
          const list = Array.isArray(current) ? current : [];
          const key = normalize(getKey(draft));
          const index = list.findIndex((item) => normalize(getKey(item)) === key);
          const next = [...list];
          if (index >= 0) next[index] = draft;
          else next.unshift(draft);
          await writeDrafts(next);
        } catch {
          // ignore
        }
      }, debounceMs);
    },
    [debounceMs, getKey, normalize, readDrafts, writeDrafts],
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

  const findByKey = useCallback(
    async (keyValue) => {
      try {
        const list = await readDrafts();
        const key = normalize(keyValue);
        return (Array.isArray(list) ? list : []).find((item) => normalize(getKey(item)) === key) || null;
      } catch {
        return null;
      }
    },
    [getKey, normalize, readDrafts],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    drafts,
    loadDrafts,
    upsertDraftDebounced,
    removeByKey,
    findByKey,
  };
};

