import { useCallback, useEffect, useState, type RefObject, type SyntheticEvent } from 'react';
import { Icon } from '../components/icons';
import { useCoarsePointer } from '../shell/useNarrow';
import { Button } from '../components/Button';

// Touch on a canvas (the graph and the ERD). A finger has no hover, so the first tap on a node
// selects it: the node is outlined and a card at the bottom of the canvas names it with an Open
// chip. A second tap on the same node, or the chip, opens it. A tap on the empty canvas lets go.
// With a mouse a click still opens at once. Pan and pinch-zoom are the canvas's own (the graph's
// camera, or React Flow's in the ERD view).

/** Whether a click came from a finger or a pen (or, when the event does not say, from a touch screen). */
export function isTap(event: SyntheticEvent | Event | undefined, coarse: boolean): boolean {
  const native = event && 'nativeEvent' in event ? event.nativeEvent : event;
  const type = (native as PointerEvent | undefined)?.pointerType;
  return type ? type !== 'mouse' : coarse;
}

export interface TapToOpen {
  /** The node selected by a first tap, waiting for a second tap or the Open chip. */
  armed: string | null;
  /** Handles a click on a node: opens it with a mouse, selects it (or opens it when already selected) with a finger. */
  onNodeClick: (event: SyntheticEvent | Event | undefined, id: string) => void;
  /** Lets go of the selected node. */
  clear: () => void;
  /** Opens the selected node. */
  openArmed: () => void;
}

/**
 * The tap-to-select, tap-again-to-open behavior of a canvas. `open` follows a node; `canOpen`
 * says whether a node can be opened at all (the center node and file nodes cannot). The selected
 * node's element (the element with its `data-id` under `wrapper`: the ERD view's node, the graph's
 * box in its accessibility layer) carries `is-armed` while selected.
 * The selection is let go when `resetKey` changes (a new focus).
 */
export function useTapToOpen(open: (id: string) => void, canOpen: (id: string) => boolean, wrapper: RefObject<HTMLElement | null>, resetKey: string): TapToOpen {
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
    if (!canOpen(id)) return;
    if (!isTap(event, coarse) || armed === id) { setArmed(null); open(id); return; }
    setArmed(id);
  }, [armed, coarse, canOpen, open]);
  const clear = useCallback(() => setArmed(null), []);
  const openArmed = useCallback(() => { if (armed) { setArmed(null); open(armed); } }, [armed, open]);
  return { armed, onNodeClick, clear, openArmed };
}

/** The card for the selected node: its kind, its name and the Open chip, at the bottom of the canvas. */
export function TapCard({ kind, name, onOpen, onDismiss }: { kind: string; name: string; onOpen: () => void; onDismiss: () => void }) {
  return (
    <div className="tap-card" role="status">
      <span className="tap-card-text">
        <small>{kind}</small>
        <strong>{name}</strong>
      </span>
      <Button variant="primary" className="tap-open" label={`Open ${name}`} onClick={onOpen}>Open</Button>
      <Button variant="icon" className="tap-dismiss" label="Let go of the selection" onClick={onDismiss}><Icon name="x" size={16} /></Button>
    </div>
  );
}
