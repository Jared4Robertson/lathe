import { useEffect, useState } from 'react';

/** Below this width the nav and the inspector become drawers. */
export const NARROW_QUERY = '(max-width: 900px)';

/** True on a narrow screen, following resizes. False where matchMedia is missing. */
export function useNarrow(): boolean {
  const media = () => (typeof window.matchMedia === 'function' ? window.matchMedia(NARROW_QUERY) : null);
  const [narrow, setNarrow] = useState(() => media()?.matches ?? false);
  useEffect(() => {
    const m = media();
    if (!m) return;
    const update = () => setNarrow(m.matches);
    update();
    m.addEventListener?.('change', update);
    return () => m.removeEventListener?.('change', update);
  }, []);
  return narrow;
}

/** Moves focus into an element that just opened (a drawer), and back to where it was when it closes. */
export function useFocusReturn(open: boolean, container: { current: HTMLElement | null }, first = 'input, a, button') {
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    container.current?.querySelector<HTMLElement>(first)?.focus();
    return () => { if (before?.isConnected) before.focus(); };
  }, [open, container, first]);
}
