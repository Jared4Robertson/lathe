import { cloneElement, useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent, type MouseEvent, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { Keys, useKeymap, useShortcutHint } from './commands';

// Tooltips the way common apps show them: a short name and, when the control has a shortcut, its
// keys ("Show or hide the navigation ⌘B", or "Ctrl+B" off a Mac). A tooltip opens after a short
// hover, at once on focus while the keyboard is in use (not on a click, and not when a page
// moves focus on load), and closes on leaving, on blur, on a click
// or on Escape. The keys come from the keymap with its overrides, so a rebinding changes the hint,
// and the control gets `aria-keyshortcuts` from the same table.

/** How long the pointer rests on a control before its tooltip shows. */
export const TOOLTIP_DELAY = 500;
/** Moving from one tooltip to the next within this time shows the next at once. */
const SKIP_DELAY = 300;

let lastPointerDown = 0;
let lastKeyDown = 0;
let lastHidden = 0;
/** Only one tooltip shows at a time: showing one hides the one before. */
let shown: { current: () => void } | null = null;
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', () => { lastPointerDown = Date.now(); }, true);
  document.addEventListener('mousedown', () => { lastPointerDown = Date.now(); }, true);
  document.addEventListener('keydown', () => { lastKeyDown = Date.now(); }, true);
}

export type Placement = 'bottom' | 'right' | 'top' | 'left';

type ChildProps = {
  'aria-keyshortcuts'?: string;
  'aria-describedby'?: string;
  onMouseEnter?: (e: MouseEvent<HTMLElement>) => void;
  onMouseLeave?: (e: MouseEvent<HTMLElement>) => void;
  onFocus?: (e: FocusEvent<HTMLElement>) => void;
  onBlur?: (e: FocusEvent<HTMLElement>) => void;
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
};

export interface TooltipProps {
  /** What the control does, in a few words. */
  label: string;
  /** The keymap command whose shortcut the control runs. */
  command?: string;
  /** Shows a graph step's Nested and Voronoi keys (`nestedKeys`) rather than the Tree view's. */
  nested?: boolean;
  placement?: Placement;
  children: ReactElement<ChildProps>;
}

export function Tooltip({ label, command, nested = false, placement = 'bottom', children }: TooltipProps) {
  const hint = useShortcutHint(command, nested);
  const { mac } = useKeymap();
  const id = useId();
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  useEffect(() => clear, []);

  const place = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const gap = 6;
    switch (placement) {
      case 'right': return { x: r.right + gap, y: r.top + r.height / 2 };
      case 'left': return { x: r.left - gap, y: r.top + r.height / 2 };
      case 'top': return { x: r.left + r.width / 2, y: r.top - gap };
      default: return { x: r.left + r.width / 2, y: r.bottom + gap };
    }
  };
  const self = useRef<() => void>(() => {});
  const hide = () => {
    clear();
    if (shown === self) shown = null;
    setAt((current) => { if (current) lastHidden = Date.now(); return null; });
  };
  self.current = hide;
  const open = (el: HTMLElement) => {
    if (shown && shown !== self) shown.current();
    shown = self;
    setAt(place(el));
  };
  const show = (el: HTMLElement, delay: number) => {
    clear();
    if (delay <= 0) { open(el); return; }
    timer.current = setTimeout(() => open(el), delay);
  };
  useEffect(() => () => { if (shown === self) shown = null; }, []);

  const props = children.props;
  const describedBy = [props['aria-describedby'], at ? id : null].filter(Boolean).join(' ') || undefined;
  const child = cloneElement(children, {
    'aria-keyshortcuts': props['aria-keyshortcuts'] ?? hint.aria,
    'aria-describedby': describedBy,
    onMouseEnter: (e) => { props.onMouseEnter?.(e); show(e.currentTarget, Date.now() - lastHidden < SKIP_DELAY ? 0 : TOOLTIP_DELAY); },
    onMouseLeave: (e) => { props.onMouseLeave?.(e); hide(); },
    onFocus: (e) => { props.onFocus?.(e); if (lastKeyDown > lastPointerDown) show(e.currentTarget, 0); },
    onBlur: (e) => { props.onBlur?.(e); hide(); },
    onClick: (e) => { props.onClick?.(e); hide(); },
    onKeyDown: (e) => { if (e.key === 'Escape' && at) hide(); props.onKeyDown?.(e); },
  });

  return (
    <>
      {child}
      {at && createPortal(
        <span role="tooltip" id={id} className={`tooltip tooltip-${placement}`} style={{ left: at.x, top: at.y }}>
          <span className="tooltip-label">{label}</span>
          {hint.binding && ' '}
          {hint.binding && <Keys binding={hint.binding} mac={mac} className="tooltip-keys" />}
        </span>,
        document.body,
      )}
    </>
  );
}
