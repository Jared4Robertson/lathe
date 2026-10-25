import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { lowerLabel } from '../plural';
import { trapTab } from './useNarrow';

// A bottom sheet, as on a phone (notes/mobile-design.md): it rises from the bottom edge to half
// the screen, with a grab handle at its top. Dragging the handle up (or a tap on it) takes it to
// full height; dragging it down takes it back to half, or away from half; a flick counts as a long
// drag. Escape, a tap on the dimmed page above it or its own close button dismisses it. Focus
// stays inside it while it is open; the caller moves focus in and gives it back.

export type SheetSize = 'half' | 'full';

/** How far a drag must go, in px, and how fast a flick is, in px per ms. */
const DRAG_TO_CLOSE = 90;
const DRAG_FULL_TO_HALF = 60;
const DRAG_UP = 40;
const FLICK = 0.6;
const TAP_SLOP = 6;

/** Where a drag of `dy` px (down is positive) at `speed` px/ms leaves a sheet of `size`: a new size, or null to close it. */
export function settle(size: SheetSize, dy: number, speed: number): SheetSize | null {
  const flick = Math.abs(speed) >= FLICK;
  if (dy < 0) return dy <= -DRAG_UP || (flick && speed < 0) ? 'full' : size;
  if (size === 'full') {
    if (dy >= DRAG_FULL_TO_HALF * 4 || (flick && dy >= DRAG_FULL_TO_HALF * 2)) return null;
    return dy >= DRAG_FULL_TO_HALF || flick ? 'half' : 'full';
  }
  return dy >= DRAG_TO_CLOSE || (flick && dy > TAP_SLOP) ? null : 'half';
}

export interface BottomSheetProps {
  /** The sheet's name, for screen readers: "Side bar", "Open pages". */
  label: string;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}

export function BottomSheet({ label, onClose, className, children }: BottomSheetProps) {
  const [size, setSize] = useState<SheetSize>('half');
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef<{ y: number; t: number } | null>(null);
  const moved = useRef(false);
  const box = useRef<HTMLDivElement>(null);
  const name = lowerLabel(label);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    start.current = { y: e.clientY, t: e.timeStamp };
    moved.current = false;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const dy = e.clientY - start.current.y;
    if (Math.abs(dy) > TAP_SLOP) moved.current = true;
    if (moved.current) setDrag(dy);
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const from = start.current;
    start.current = null;
    setDrag(null);
    if (!from || !moved.current) return;
    const dy = e.clientY - from.y;
    const next = settle(size, dy, dy / Math.max(1, e.timeStamp - from.t));
    if (next) setSize(next); else onClose();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onClose(); return; }
    trapTab(e, box.current);
  };

  // Dragged down, the sheet follows the finger; dragged up, it waits for the release to grow.
  const offset = drag !== null && drag > 0 ? drag : 0;
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={box}
        className={`bottom-sheet is-${size}${drag !== null ? ' is-dragging' : ''}${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        data-size={size}
        style={offset ? { transform: `translateY(${offset}px)` } : undefined}
        onKeyDown={onKeyDown}
      >
        <div className="sheet-grab" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          <button
            type="button"
            className="sheet-handle"
            aria-label={size === 'half' ? `Expand the ${name} to full height` : `Shrink the ${name} to half height`}
            onClick={() => { if (!moved.current) setSize(size === 'half' ? 'full' : 'half'); moved.current = false; }}
          >
            <span className="sheet-handle-bar" aria-hidden="true" />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </>
  );
}
