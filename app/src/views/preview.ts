import { useSyncExternalStore } from 'react';

// The stage's preview (LA-V64): while quick find highlights a record, the focus page shows it on
// its stage and in its wiki card without moving the address or the tabs; when quick
// find commits, the address moves there, and when it is dismissed the preview ends and the stage,
// the card and the camera go back to the page's own focus. One preview at a time, for the window.

let previewed: string | null = null;
const listeners = new Set<() => void>();

/** Shows a record on the stage and in the wiki card for now, or ends the preview (null). */
export function setPreview(id: string | null) {
  if (previewed === id) return;
  previewed = id;
  for (const l of listeners) l();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

/** The record previewed now, or null. */
export function usePreview(): string | null {
  return useSyncExternalStore(subscribe, () => previewed, () => null);
}
