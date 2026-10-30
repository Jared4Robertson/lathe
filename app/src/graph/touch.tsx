import { useCallback, useEffect, useState, type RefObject, type SyntheticEvent } from 'react';
import { Icon } from '../components/icons';
import { useCoarsePointer } from '../shell/useNarrow';
import { Button } from '../components/Button';
import { Card } from '../shell/Card';

// Touch on a canvas (the graph and the ERD). A finger has no hover, so the first tap on a node
// selects it: the node is outlined and a card at the bottom of the canvas names it. A second tap
// on the same node, or a tap on the card, opens it. A tap on the empty canvas lets go.
// With a mouse a click still opens at once. Pan and pinch-zoom are the canvas's own (the shared
// camera's gestures, gestures.ts).

/** The native event of a React or DOM event. */
const nativeOf = (event: SyntheticEvent | Event | undefined) => (event && 'nativeEvent' in event ? event.nativeEvent : event) as MouseEvent | undefined;

/** Whether a click came from a finger or a pen (or, when the event does not say, from a touch screen). */
export function isTap(event: SyntheticEvent | Event | undefined, coarse: boolean): boolean {
  const type = (nativeOf(event) as PointerEvent | undefined)?.pointerType;
  return type ? type !== 'mouse' : coarse;
}

export interface TapToOpen {
  /** The node selected by a first tap, waiting for a second tap or a tap on its card. */
  armed: string | null;
  /** Handles a click on a node: opens it with a mouse, selects it (or opens it when already selected) with a finger; with Cmd or Ctrl held, opens it in a new place. */
  onNodeClick: (event: SyntheticEvent | Event | undefined, id: string) => void;
  /** Handles a middle-click on a node: opens it in a new place in the background. */
  onNodeAuxClick: (event: SyntheticEvent | Event | undefined, id: string) => void;
  /** Lets go of the selected node. */
  clear: () => void;
  /** Opens the selected node. */
  openArmed: () => void;
}

/**
 * The tap-to-select, tap-again-to-open behavior of a canvas. `open` follows a node; `canOpen`
 * says whether a node can be opened at all (the center node and file nodes cannot). The selected
 * node's element (the element with its `data-id` under `wrapper`: the box in the Graph's or the
 * ERD's accessibility layer) carries `is-armed` while selected.
 * The selection is let go when `resetKey` changes (a new focus). With `openNew` (a host with places, views/place.ts),
 * Cmd or Ctrl+click opens a node in a new place and a middle-click opens it there in the background, as a browser
 * opens a link in a new tab.
 */
export function useTapToOpen(open: (id: string) => void, canOpen: (id: string) => boolean, wrapper: RefObject<HTMLElement | null>, resetKey: string, openNew?: (id: string, background: boolean) => void): TapToOpen {
  const coarse = useCoarsePointer();
  const [armed, setArmed] = useState<string | null>(null);
  useEffect(() => { setArmed(null); }, [resetKey]);

  useEffect(() => {
    if (!armed) return;
    const el = [...(wrapper.current?.querySelectorAll<HTMLElement>('[data-id]') ?? [])].find((n) => n.dataset.id === armed);
    el?.classList.add('is-armed');
    return () => el?.classList.remove('is-armed');
  }, [armed, wrapper]);

  const onNodeClick = useCallback((event: SyntheticEvent | Event | undefined, id: string) => {
    const native = nativeOf(event);
    if (openNew && (native?.metaKey || native?.ctrlKey) && (canOpen(id) || id === resetKey)) { event?.preventDefault?.(); setArmed(null); openNew(id, false); return; }
    if (!canOpen(id)) return;
    if (!isTap(event, coarse) || armed === id) { setArmed(null); open(id); return; }
    setArmed(id);
  }, [armed, coarse, canOpen, open, openNew, resetKey]);
  const onNodeAuxClick = useCallback((event: SyntheticEvent | Event | undefined, id: string) => {
    if (!openNew || nativeOf(event)?.button !== 1 || !(canOpen(id) || id === resetKey)) return;
    event?.preventDefault?.();
    openNew(id, true);
  }, [canOpen, openNew, resetKey]);
  const clear = useCallback(() => setArmed(null), []);
  const openArmed = useCallback(() => { if (armed) { setArmed(null); open(armed); } }, [armed, open]);
  return { armed, onNodeClick, onNodeAuxClick, clear, openArmed };
}

/** The card for the selected node, at the bottom of the canvas: its kind and name; a tap on it opens the node. */
export function TapCard({ kind, name, onOpen, onDismiss }: { kind: string; name: string; onOpen: () => void; onDismiss: () => void }) {
  return (
    <Card
      as="div"
      look="bar"
      role="status"
      onActivate={onOpen}
      title={<><span className="tap-text"><span className="sr-only">Open</span>{' '}<small>{kind}</small>{' '}<strong>{name}</strong></span><Icon name="chevron-right" size={18} /></>}
    >
      <Button variant="icon" className="tap-dismiss" label="Let go of the selection" onClick={onDismiss}><Icon name="x" size={16} /></Button>
    </Card>
  );
}
