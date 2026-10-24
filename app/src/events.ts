// Calls back when specs or diagrams change on disk: through Vite's hot-reload channel in
// development, or through the server-sent events of `lathe serve` otherwise.
export type LatheEvent = 'spec:changed' | 'model:changed';

export function onLatheEvent(event: LatheEvent, callback: () => void): () => void {
  if (import.meta.hot) {
    import.meta.hot.on(event, callback);
    return () => import.meta.hot?.off?.(event, callback);
  }
  const source = new EventSource('/api/events');
  source.onmessage = (message) => {
    if (message.data === event) callback();
  };
  return () => source.close();
}
