import type { DataChange } from '../../lathe/src/server/events';

// Calls back when the specs change on disk or by a write: through Vite's hot-reload channel in development, or
// through the server-sent events of `lathe serve` otherwise (GET /api/events, LA-PLT-EP02-CL). Each change names the
// tables and read models it changed (Data files changed, LA-PLT-EV06); null is a change to everything. The channel
// greets each page with an empty change when it opens (again after a reconnect, when anything may have changed).
export type LatheEvent = 'spec:changed';

export type { DataChange };

/** The change a message carries, or null when it names none (everything may have changed). */
function changeOf(data: unknown): DataChange | null {
  const value = typeof data === 'string' ? (() => { try { return JSON.parse(data) as unknown; } catch { return null; } })() : data;
  if (!value || typeof value !== 'object') return null;
  const { tables, readModels } = value as Partial<DataChange>;
  if (!Array.isArray(tables) || !(readModels === null || Array.isArray(readModels))) return null;
  return { tables, readModels };
}

export function onLatheEvent(event: LatheEvent, callback: (change: DataChange | null) => void): () => void {
  if (import.meta.hot) {
    const heard = (data: unknown) => callback(changeOf(data));
    import.meta.hot.on(event, heard);
    // Vite's channel is open as the page runs: it is greeted as `lathe serve` greets each page, with no change.
    queueMicrotask(() => callback({ tables: [], readModels: [] }));
    return () => import.meta.hot?.off?.(event, heard);
  }
  const source = new EventSource('/api/events');
  const heard = (message: MessageEvent) => callback(changeOf(message.data));
  source.addEventListener(event, heard);
  return () => source.close();
}
