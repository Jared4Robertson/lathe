import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { lowerLabel } from '../plural';
import { trapTab, useLandscape } from './useNarrow';

// A bottom sheet, as on a phone (notes/mobile-design.md): it rises from the bottom edge to half
// the screen, with a grab handle at its top. Dragging the handle up (or a tap on it) takes it to
// full height, which reaches up to just under the top bar (`data-top-bar`: the phone's top bar and
// the compact page bar), so the menu, quick find, Up and the stage switch stay in reach; dragging it
// down takes it back to half, or away from half; a flick counts as a long drag. On a phone on its
// side it opens at full height, as half would show little more than its head. Escape or its own
// close button dismisses it; a tap on the dimmed page above it takes a full sheet back to half and
// dismisses a half one. Focus stays inside it while it is open; the caller moves focus in and gives it back.

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

/** Where a full sheet's top stops: the bottom of the lowest top bar showing (`data-top-bar`), or the screen's top. */
function topBarBottom(): number {
  let bottom = 0;
  for (const bar of document.querySelectorAll<HTMLElement>('[data-top-bar]')) bottom = Math.max(bottom, bar.getBoundingClientRect().bottom);
  return Math.round(bottom);
}

export interface BottomSheetProps {
  /** The sheet's name, for screen readers: "Wiki card", "Open pages". */
  label: string;
  onClose: () => void;
  className?: string;
  /** Its size, when the caller holds it (the wiki card's: full is More, half is Less); otherwise the sheet's own. */
  size?: SheetSize;
  onSize?: (size: SheetSize) => void;
  children: ReactNode;
}

export function BottomSheet({ label, onClose, className, size: held, onSize, children }: BottomSheetProps) {
  const [own, setOwn] = useState<SheetSize>('half');
  const chosen = held ?? own;
  const setSize = (next: SheetSize) => { if (held === undefined) setOwn(next); onSize?.(next); };
  // On its side a phone has no room for half a sheet: it shows at full height.
  const landscape = useLandscape();
  const size: SheetSize = landscape ? 'full' : chosen;
  // The top bar stays above a full sheet and its backdrop, measured as it is (its height follows the safe area and the pointer).
  const [top, setTop] = useState(0);
  useLayoutEffect(() => {
    const measure = () => setTop(topBarBottom());
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
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
    // On its side the sheet has no half: a drag down dismisses it as it would from half.
    const next = settle(landscape ? 'half' : size, dy, dy / Math.max(1, e.timeStamp - from.t));
    if (next) setSize(next); else onClose();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onClose(); return; }
    trapTab(e, box.current);
  };

  // Dragged down, the sheet follows the finger; dragged up, it waits for the release to grow.
  const offset = drag !== null && drag > 0 ? drag : 0;
  const edge = { '--sheet-top': `${top}px` } as CSSProperties;
  // A tap on the dimmed page takes a full sheet back to half, and dismisses a half one.
  const onBackdrop = () => { if (size === 'full' && !landscape) setSize('half'); else onClose(); };
  return (
    <>
      <div className="sheet-backdrop" style={edge} onClick={onBackdrop} aria-hidden="true" />
      <div
        ref={box}
        className={`bottom-sheet is-${size}${drag !== null ? ' is-dragging' : ''}${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        data-size={size}
        style={offset ? { ...edge, transform: `translateY(${offset}px)` } : edge}
        onKeyDown={onKeyDown}
      >
        <div className="sheet-grab" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          {/* On its side the sheet has one height: its handle only drags it away. */}
          {landscape ? (
            <span className="sheet-handle"><span className="sheet-handle-bar" aria-hidden="true" /></span>
          ) : (
            <button
              type="button"
              className="sheet-handle"
              aria-label={size === 'half' ? `Expand the ${name} to full height` : `Shrink the ${name} to half height`}
              onClick={() => { if (!moved.current) setSize(size === 'half' ? 'full' : 'half'); moved.current = false; }}
            >
              <span className="sheet-handle-bar" aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </>
  );
}
