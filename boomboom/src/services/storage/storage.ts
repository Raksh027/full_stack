import { createMMKV } from 'react-native-mmkv';

import type { StorageKey } from './storageKeys';

export const storage = createMMKV({ id: 'boomboom.app' });

export function getJSON<T>(key: StorageKey): T | undefined {
  const raw = storage.getString(key);
  if (raw === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    storage.remove(key);
    return undefined;
  }
}

export function setJSON(key: StorageKey, value: unknown) {
  storage.set(key, JSON.stringify(value));
}

export function removeItem(key: StorageKey) {
  storage.remove(key);
}
