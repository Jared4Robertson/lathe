import { useCallback, useState } from 'react';

// Remembered choices (nav collapsed, view mode, split ratio, ...). Storage can be missing or
// throw (private windows, blocked site data), so every read and write is guarded and the app
// works without it.

type Store = 'local' | 'session';
const storage = (store: Store): Storage | null => {
  try { return store === 'local' ? window.localStorage : window.sessionStorage; } catch { return null; }
};

export function readPref<T>(key: string, fallback: T, valid: (v: unknown) => v is T, store: Store = 'local'): T {
  try {
    const raw = storage(store)?.getItem(key);
    if (raw == null) return fallback;
    const value: unknown = JSON.parse(raw);
    return valid(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function writePref(key: string, value: unknown, store: Store = 'local') {
  try { storage(store)?.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

export const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
export const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** useState that is read from and written to storage. */
export function usePref<T>(key: string, fallback: T, valid: (v: unknown) => v is T, store: Store = 'local') {
  const [value, setValue] = useState<T>(() => readPref(key, fallback, valid, store));
  const set = useCallback((next: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      writePref(key, v, store);
      return v;
    });
  }, [key, store]);
  return [value, set] as const;
}
