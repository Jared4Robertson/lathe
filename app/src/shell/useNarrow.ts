import { useEffect, useState, type KeyboardEvent } from 'react';

/**
 * Below this width the app takes its phone layout (notes/mobile-design.md): one view at a time,
 * a compact top bar, and sheets instead of panels. The width decides the layout; the pointer
 * decides the size of targets, so a tablet in landscape keeps the workbench with touch targets.
 */
export const NARROW_QUERY = '(max-width: 900px)';
/** A phone on its side: a sheet at half height would show only its head, so sheets open at full height. */
export const LANDSCAPE_QUERY = '(orientation: landscape)';
/** A touch screen (or a pen) is the main pointer: targets are at least 44 × 44 px and taps select before they open. */
export const COARSE_QUERY = '(pointer: coarse)';

/** Whether a media query matches, following changes. False where matchMedia is missing. */
function useMedia(query: string): boolean {
  const media = () => (typeof window.matchMedia === 'function' ? window.matchMedia(query) : null);
  const [matches, setMatches] = useState(() => media()?.matches ?? false);
  useEffect(() => {
    const m = media();
    if (!m) return;
    const update = () => setMatches(m.matches);
    update();
    m.addEventListener?.('change', update);
    return () => m.removeEventListener?.('change', update);
  }, [query]);
  return matches;
}

/** True on a narrow screen (the phone layout), following resizes. */
export function useNarrow(): boolean {
  return useMedia(NARROW_QUERY);
}

/** True when the screen is wider than tall, following turns. */
export function useLandscape(): boolean {
  return useMedia(LANDSCAPE_QUERY);
}

/** True when the main pointer is coarse (a finger). */
export function useCoarsePointer(): boolean {
  return useMedia(COARSE_QUERY);
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/**
 * Keeps Tab inside a sheet (the nav, a bottom sheet, quick find): from the last control Tab goes
 * to the first, and Shift+Tab from the first (or from the sheet itself) to the last.
 */
export function trapTab(e: KeyboardEvent<HTMLElement>, sheet: HTMLElement | null) {
  if (e.key !== 'Tab' || !sheet) return;
  const items = [...sheet.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.closest('[inert]'));
  if (items.length === 0) { e.preventDefault(); return; }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && (active === first || active === sheet)) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
}
