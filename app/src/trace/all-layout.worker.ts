/// <reference lib="webworker" />
import { layOutColumns, type LayoutInput } from './all-layout';

// The All-at-once view's layout worker (all-laid.ts): orders and places the view's boxes off the page's main thread, so
// the camera never waits on a layout. It measures no text: every box is the same size.

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (e: MessageEvent<{ id: number; input: LayoutInput }>) => {
  const start = performance.now();
  const result = layOutColumns(e.data.input);
  self.postMessage({ id: e.data.id, result, ms: performance.now() - start }, [result.y.buffer]);
};
