import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { navigate } from '../router';
import { Button } from '../components/Button';
import { Icon } from '../components/icons';
import { BottomSheet, type SheetSize } from '../shell/BottomSheet';
import { inertBehind } from '../shell/useNarrow';
import { Tooltip } from '../shell/Tooltip';
import { PAGE_PARAM, panelHref, useOverlayFocus } from './overlays';

// On a phone a page opened from a tool's sheet (a problem in Checks, a change in Changes) shows in the wiki card's
// sheet, the tool closing (LA-V61-R56): the tool asks for the sheet here, and the focus page, drawn for the new
// address, opens it. The request waits a moment for a focus page to take it, as the page may be drawn after the move;
// a request no page takes lapses, so it never opens a sheet later out of the blue.

const LAPSE_MS = 2000;
let asked = -Infinity;
const listeners = new Set<() => void>();

/** Asks the focus page to open the wiki card's sheet. */
function showCardSheet() {
  asked = Date.now();
  for (const fn of listeners) fn();
}

/** Calls `open` for a request waiting now and for each one made later, until the returned function stops it. */
export function onCardSheetAsked(open: () => void): () => void {
  const take = () => { if (Date.now() - asked > LAPSE_MS) return; asked = -Infinity; open(); };
  listeners.add(take);
  take();
  return () => { listeners.delete(take); };
}

/**
 * On a phone a link in a tool's sheet that opens a page (a record, a check's page in the card) shows that page in the
 * wiki card's sheet, and the tool closes, so the record is what shows, not the tool over a dimmed page (LA-V61-R56).
 * Back comes to the tool again. A link that only switches the tool (Appearance's Edit and Done) stays as it is.
 */
function openInCard(e: MouseEvent<HTMLElement>) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
  if (!a) return;
  const to = new URL(a.href, window.location.href);
  if (to.pathname === window.location.pathname && !to.searchParams.get(PAGE_PARAM)) return;
  e.preventDefault();
  e.stopPropagation();
  navigate(to.pathname + to.search + to.hash);
  navigate(panelHref(null), true);
  showCardSheet();
}

/** A full-window tool is modal: its arrow keys walk its links, never the stage underneath. */
function walkLinks(e: KeyboardEvent<HTMLElement>) {
  if ((e.key !== 'ArrowDown' && e.key !== 'ArrowUp') || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  const links = [...e.currentTarget.querySelectorAll<HTMLElement>('a[href]')].filter((a) => !a.closest('[inert]'));
  if (links.length === 0) return;
  e.preventDefault();
  const at = links.indexOf(e.target as HTMLElement);
  const step = e.key === 'ArrowDown' ? 1 : -1;
  links[(at + step + links.length) % links.length]?.focus();
}

export interface ToolPanelProps {
  /** Its name, for its heading and for screen readers: "Checks", "Appearance". */
  label: string;
  /** What heads it, after the label: counts, actions. */
  head?: ReactNode;
  /** Its class, which sets its place and width: `checks-panel`, `appearance-popover`, `theme-panel`. */
  className: string;
  /** On a phone: a bottom sheet. */
  sheet: boolean;
  onClose: () => void;
  /** It fills the window and is modal, so nothing else on the page can be reached: the Dashboard, the one tool that fills the window (LA-PAT-APP-UX-R20). */
  full?: boolean;
  children: ReactNode;
}

/**
 * A tool over the stage (LA-PAT-APP-UX-R20): a frosted panel floating at the left of the open space, right of
 * the nav, which the open space leaves room for (`data-floating`), with its name and a close button;
 * on a phone, a bottom sheet. It takes focus as it opens and gives it back as it closes.
 */
export function ToolPanelFrame({ label, head, className, sheet, onClose, full = false, children }: ToolPanelProps) {
  const box = useRef<HTMLElement>(null);
  useOverlayFocus(box);
  const [size, setSize] = useState<SheetSize>('full');
  useEffect(() => (full && !sheet ? inertBehind(box.current) : undefined), [full, sheet]);
  const modal = full ? { role: 'dialog', 'aria-modal': true, onKeyDown: walkLinks } as const : null;
  const close = (
    <Tooltip label={`Close ${label}`} placement="left">
      <Button variant="icon" label={`Close ${label}`} className="tool-panel-close" onClick={onClose}><Icon name="x" size={16} /></Button>
    </Tooltip>
  );
  const top = (
    <div className="tool-panel-head">
      <h2 className="tool-panel-title">{label}</h2>
      {head}
      {close}
    </div>
  );
  if (sheet) {
    return (
      <BottomSheet label={label} className={`tool-sheet ${className}`} onClose={onClose} {...(full ? { size, onSize: setSize } : {})}>
        <section ref={box} className="tool-panel is-sheet" aria-label={label} tabIndex={-1} onClickCapture={openInCard} {...modal}>
          {top}
          <div className="tool-panel-scroll">{children}</div>
        </section>
      </BottomSheet>
    );
  }
  return (
    <section ref={box} className={`tool-panel ${className}`} aria-label={label} tabIndex={-1} data-floating={full ? undefined : 'left'} {...modal}>
      {top}
      <div className="tool-panel-scroll">{children}</div>
    </section>
  );
}
