/// <reference lib="webworker" />
import { orderColumns, type OrderInput } from './columns';

// The Trace stage's ordering worker (order.ts): orders its outcomes and rows off the page's main thread, so
// the camera never waits on an order. It measures no text.

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (e: MessageEvent<{ id: number; input: OrderInput }>) => {
  const start = performance.now();
  const order = orderColumns(e.data.input);
  self.postMessage({ id: e.data.id, order, ms: performance.now() - start });
};
