import type { RefObject } from 'react';

// After a record's form or its remove question closes, the focus goes back to the actions that opened it (the record's
// Change toolbar, or a section's), scrolled into view in the card, where the form was opened. The write reloads the data,
// which may draw the page anew a moment later and drop the focus; until the Reader acts (a click, a key, the focus moved
// elsewhere), it is put back on the toolbar as drawn now, found by its name.

/** How long a reload may take to draw the page anew after the form closes (a section that reads its own query, such as a pattern's followers, draws its actions only once read). */
const RELOAD_MS = 10_000;

/** Puts the focus back on the toolbar the form was opened from, in view: `label` its accessible name, `toolbar` the one drawn when the form opened, if the caller holds it. */
export function backToActions(label: string, toolbar?: RefObject<HTMLElement | null>) {
  const find = () => (toolbar?.current?.isConnected ? toolbar.current : document.querySelector<HTMLElement>(`[role="toolbar"][aria-label="${CSS.escape(label)}"]`));
  let placed: HTMLElement | null = null;
  const place = () => {
    const button = find()?.querySelector<HTMLElement>('button');
    if (!button) return;
    button.focus({ preventScroll: true });
    button.scrollIntoView({ block: 'nearest' });
    placed = button;
  };
  const until = performance.now() + RELOAD_MS;
  // The Reader acting ends the watch: from then on the focus is theirs.
  let acted = false;
  const act = () => { acted = true; };
  const events = ['pointerdown', 'keydown', 'wheel'] as const;
  for (const e of events) window.addEventListener(e, act, { capture: true, once: true });
  const end = () => { for (const e of events) window.removeEventListener(e, act, { capture: true }); };
  const watch = () => {
    const active = document.activeElement;
    // The Reader acted, or moved the focus elsewhere: leave it there.
    if (acted || (placed && active !== placed && active !== document.body && active !== null)) { end(); return; }
    if (!placed || !placed.isConnected || active !== placed) place();
    if (performance.now() < until) requestAnimationFrame(watch);
    else end();
  };
  setTimeout(watch, 0);
}
