import { useCallback, type SyntheticEvent } from 'react';

// A click on a node of a canvas (the Graph, the ERD and the Trace). A tap with a finger is a click: one tap opens the
// node, as a mouse click does (LA-V93-R02). A drag or a pinch is never a tap: the shared camera's gestures (gestures.ts)
// call a press a tap only when it ends where it began. With Cmd or Ctrl held a click opens the node in a new place, and
// a middle-click opens it there in the background, as a browser opens a link in a new tab.

/** The native event of a React or DOM event. */
const nativeOf = (event: SyntheticEvent | Event | undefined) => (event && 'nativeEvent' in event ? event.nativeEvent : event) as MouseEvent | undefined;

export interface NodeClick {
  /** Handles a click or a tap on a node: opens it; with Cmd or Ctrl held, opens it in a new place. */
  onNodeClick: (event: SyntheticEvent | Event | undefined, id: string) => void;
  /** Handles a middle-click on a node: opens it in a new place in the background. */
  onNodeAuxClick: (event: SyntheticEvent | Event | undefined, id: string) => void;
}

/**
 * A canvas's node clicks. `open` follows a node; `canOpen` says whether a node can be opened at all (the focus and
 * file nodes cannot). With `openNew` (a host with places, views/place.ts), Cmd or Ctrl+click opens a node, the focus
 * included, in a new place, and a middle-click opens it there in the background.
 */
export function useNodeClick(open: (id: string) => void, canOpen: (id: string) => boolean, focus: string, openNew?: (id: string, background: boolean) => void): NodeClick {
  const onNodeClick = useCallback((event: SyntheticEvent | Event | undefined, id: string) => {
    const native = nativeOf(event);
    if (openNew && (native?.metaKey || native?.ctrlKey) && (canOpen(id) || id === focus)) { event?.preventDefault?.(); openNew(id, false); return; }
    if (canOpen(id)) open(id);
  }, [canOpen, open, openNew, focus]);
  const onNodeAuxClick = useCallback((event: SyntheticEvent | Event | undefined, id: string) => {
    if (!openNew || nativeOf(event)?.button !== 1 || !(canOpen(id) || id === focus)) return;
    event?.preventDefault?.();
    openNew(id, true);
  }, [canOpen, openNew, focus]);
  return { onNodeClick, onNodeAuxClick };
}
