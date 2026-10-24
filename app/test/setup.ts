import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { resetExpanded } from '../src/components/TreeList';

// jsdom has no EventSource or scrolling; the app uses both.
class FakeEventSource {
  onmessage: ((message: MessageEvent) => void) | null = null;
  constructor(public url: string) {}
  close() {}
}

// Node's own localStorage (without --localstorage-file) shadows jsdom's and throws, so both
// storages are plain in-memory ones here.
class MemoryStorage {
  private items = new Map<string, string>();
  get length() { return this.items.size; }
  clear() { this.items.clear(); }
  getItem(key: string) { return this.items.get(key) ?? null; }
  key(i: number) { return [...this.items.keys()][i] ?? null; }
  removeItem(key: string) { this.items.delete(key); }
  setItem(key: string, value: string) { this.items.set(key, String(value)); }
}
if (typeof window !== 'undefined') {
  for (const name of ['localStorage', 'sessionStorage']) {
    Object.defineProperty(window, name, { configurable: true, value: new MemoryStorage() });
    Object.defineProperty(globalThis, name, { configurable: true, value: (window as unknown as Record<string, unknown>)[name] });
  }
}

beforeEach(() => {
  if (typeof window === 'undefined') return; // server tests run in node
  vi.stubGlobal('EventSource', FakeEventSource);
  window.scrollTo = () => {};
  window.history.replaceState(null, '', '/');
  // Remembered choices (view, nav, inspector, open rows) start fresh in every test.
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetExpanded();
});

afterEach(() => {
  if (typeof window !== 'undefined') cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
