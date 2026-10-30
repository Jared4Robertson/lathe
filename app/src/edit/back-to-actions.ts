import type { RefObject } from 'react';

// After a record's form or its remove question closes, the focus goes back to the actions that opened it (the record's
// Change toolbar, or a section's), scrolled into view in the card, where the form was opened. The write reloads the data,
// which may draw the page anew a moment later and drop the focus; until the Reader moves the focus themselves, it is
// put back on the toolbar as drawn now, found by its name.

/** How long a reload may take to draw the page anew after the form closes. */
const RELOAD_MS = 2000;

/** Puts the focus back on the toolbar the form was opened from, in view, `label` its accessible name. */
export function backToActions(toolbar: RefObject<HTMLElement | null>, label: string) {
  const find = () => (toolbar.current?.isConnected ? toolbar.current : document.querySelector<HTMLElement>(`[role="toolbar"][aria-label="${CSS.escape(label)}"]`));
  let placed: HTMLElement | null = null;
  const place = () => {
    const button = find()?.querySelector<HTMLElement>('button');
    if (!button) return;
    button.focus({ preventScroll: true });
    button.scrollIntoView({ block: 'nearest' });
    placed = button;
  };
  const until = performance.now() + RELOAD_MS;
  const watch = () => {
    // The Reader moved the focus elsewhere: leave it there.
    const active = document.activeElement;
    if (placed && active !== placed && active !== document.body && active !== null) return;
    if (!placed || !placed.isConnected || active !== placed) place();
    if (performance.now() < until) requestAnimationFrame(watch);
  };
  setTimeout(watch, 0);
}
