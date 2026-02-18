import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';
import { SUPABASE_CONFIG } from './supabaseConfig';

const INTERNAL_KEYS = {
  DEVICE_SCOPE: '__supabase_device_scope_v1',
  MIGRATED_ONCE: '__supabase_migrated_once_v1',
};

const BRIDGE_STATE = {
  installed: false,
  warnedMissingConfig: false,
  warnedRemoteError: false,
  remoteDisabled: false,
  original: null,
};

const getOriginal = () => BRIDGE_STATE.original;

const safeJsonParse = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const getOrCreateDeviceScope = async () => {
  const original = getOriginal();
  const saved = await original.getItem(INTERNAL_KEYS.DEVICE_SCOPE);

  if (saved) {
    return saved;
  }

  const generated = `device_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  await original.setItem(INTERNAL_KEYS.DEVICE_SCOPE, generated);
  return generated;
};

const runRemote = async (operationName, operation) => {
  if (BRIDGE_STATE.remoteDisabled) {
    return null;
  }

  if (!isSupabaseConfigured()) {
    if (!BRIDGE_STATE.warnedMissingConfig) {
      BRIDGE_STATE.warnedMissingConfig = true;
      console.warn(
        '[SupabaseBridge] Supabase não configurado. Usando somente AsyncStorage local.',
      );
    }
    return null;
  }

  const client = getSupabaseClient();
  if (!client) {
    return null;
  }

  try {
    return await operation(client);
  } catch (error) {
    if (!BRIDGE_STATE.warnedRemoteError) {
      BRIDGE_STATE.warnedRemoteError = true;
      console.warn(
        `[SupabaseBridge] Falha em ${operationName}. Fallback local ativo.`,
        error?.message || error,
      );
    }
    BRIDGE_STATE.remoteDisabled = true;
    return null;
  }
};

const remoteGetItem = async (key) => {
  const scope = await getOrCreateDeviceScope();

  const result = await runRemote('getItem', async (client) => {
    const { data, error } = await client
      .from(SUPABASE_CONFIG.storageTable)
      .select('value')
      .eq('scope', scope)
      .eq('key', key)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data?.value ?? null;
  });

  return result;
};

const remoteSetItem = async (key, value) => {
  const scope = await getOrCreateDeviceScope();

  await runRemote('setItem', async (client) => {
    const { error } = await client.from(SUPABASE_CONFIG.storageTable).upsert(
      [
        {
          scope,
          key,
          value,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: 'scope,key' },
    );

    if (error) {
      throw error;
    }
  });
};

const remoteRemoveItem = async (key) => {
  const scope = await getOrCreateDeviceScope();

  await runRemote('removeItem', async (client) => {
    const { error } = await client
      .from(SUPABASE_CONFIG.storageTable)
      .delete()
      .eq('scope', scope)
      .eq('key', key);

    if (error) {
      throw error;
    }
  });
};

const remoteGetAllKeys = async () => {
  const scope = await getOrCreateDeviceScope();

  const keys = await runRemote('getAllKeys', async (client) => {
    const { data, error } = await client
      .from(SUPABASE_CONFIG.storageTable)
      .select('key')
      .eq('scope', scope);

    if (error) {
      throw error;
    }

    return (data || []).map((item) => item.key);
  });

  return Array.isArray(keys) ? keys : [];
};

const remoteClearScope = async (scope) => {
  if (!scope) return;

  await runRemote('clear', async (client) => {
    const { error } = await client
      .from(SUPABASE_CONFIG.storageTable)
      .delete()
      .eq('scope', scope);

    if (error) {
      throw error;
    }
  });
};

const migrateLocalKeysToRemoteOnce = async () => {
  const original = getOriginal();
  const migrated = await original.getItem(INTERNAL_KEYS.MIGRATED_ONCE);
  if (migrated === 'true') {
    return;
  }

  const allKeys = await original.getAllKeys();
  const keysToSync = allKeys.filter(
    (key) => !Object.values(INTERNAL_KEYS).includes(key),
  );
  const pairs = await original.multiGet(keysToSync);

  await Promise.all(
    pairs.map(async ([key, value]) => {
      if (value === null || value === undefined) return;
      await remoteSetItem(key, value);
    }),
  );

  await original.setItem(INTERNAL_KEYS.MIGRATED_ONCE, 'true');
};

export const installSupabaseStorageBridge = () => {
  if (BRIDGE_STATE.installed) {
    return;
  }

  BRIDGE_STATE.original = {
    getItem: AsyncStorage.getItem.bind(AsyncStorage),
    setItem: AsyncStorage.setItem.bind(AsyncStorage),
    removeItem: AsyncStorage.removeItem.bind(AsyncStorage),
    multiGet: AsyncStorage.multiGet.bind(AsyncStorage),
    multiSet: AsyncStorage.multiSet.bind(AsyncStorage),
    multiRemove: AsyncStorage.multiRemove.bind(AsyncStorage),
    getAllKeys: AsyncStorage.getAllKeys.bind(AsyncStorage),
    clear: AsyncStorage.clear.bind(AsyncStorage),
  };

  AsyncStorage.getItem = async (key, callback) => {
    const original = getOriginal();
    const localValue = await original.getItem(key);
    const remoteValue = await remoteGetItem(key);
    const value = remoteValue ?? localValue;

    if (callback) callback(null, value);
    return value;
  };

  AsyncStorage.setItem = async (key, value, callback) => {
    const original = getOriginal();
    await original.setItem(key, value);
    await remoteSetItem(key, value);
    if (callback) callback(null);
    return null;
  };

  AsyncStorage.removeItem = async (key, callback) => {
    const original = getOriginal();
    await original.removeItem(key);
    await remoteRemoveItem(key);
    if (callback) callback(null);
    return null;
  };

  AsyncStorage.multiGet = async (keys, callback) => {
    const results = await Promise.all(
      keys.map(async (key) => [key, await AsyncStorage.getItem(key)]),
    );
    if (callback) callback(null, results);
    return results;
  };

  AsyncStorage.multiSet = async (keyValuePairs, callback) => {
    await Promise.all(
      keyValuePairs.map(([key, value]) => AsyncStorage.setItem(key, value)),
    );
    if (callback) callback(null);
    return null;
  };

  AsyncStorage.multiRemove = async (keys, callback) => {
    await Promise.all(keys.map((key) => AsyncStorage.removeItem(key)));
    if (callback) callback(null);
    return null;
  };

  AsyncStorage.getAllKeys = async (callback) => {
    const original = getOriginal();
    const localKeys = await original.getAllKeys();
    const remoteKeys = await remoteGetAllKeys();
    const merged = Array.from(new Set([...localKeys, ...remoteKeys])).filter(
      (key) => !Object.values(INTERNAL_KEYS).includes(key),
    );
    if (callback) callback(null, merged);
    return merged;
  };

  AsyncStorage.clear = async (callback) => {
    const original = getOriginal();
    const previousScope = await original.getItem(INTERNAL_KEYS.DEVICE_SCOPE);
    await original.clear();
    await remoteClearScope(previousScope);
    if (callback) callback(null);
    return null;
  };

  BRIDGE_STATE.installed = true;

  migrateLocalKeysToRemoteOnce().catch((error) => {
    const details = safeJsonParse(error?.message) || error?.message || error;
    console.warn('[SupabaseBridge] Falha ao migrar cache local inicial.', details);
  });
};
