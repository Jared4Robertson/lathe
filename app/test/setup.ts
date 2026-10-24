import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// jsdom has no EventSource or scrolling; the app uses both.
class FakeEventSource {
  onmessage: ((message: MessageEvent) => void) | null = null;
  constructor(public url: string) {}
  close() {}
}

beforeEach(() => {
  if (typeof window === 'undefined') return; // server tests run in node
  vi.stubGlobal('EventSource', FakeEventSource);
  window.scrollTo = () => {};
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  if (typeof window !== 'undefined') cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
