// The Dock (macOS): its badge, the number of check errors in the focused window's product, and its
// menu, "New Window" above the system's list of recent folders (app.addRecentDocument). Pure, so
// test/dock.test.ts covers it; main.ts applies it.
import type { MenuItemConstructorOptions } from 'electron';

/** The most errors a page may report; anything above is refused as nonsense. */
const MAX_COUNT = 1_000_000;

/** An error count from the page: a whole number from 0 up; null for anything else. */
export function parseErrorCount(input: unknown): number | null {
  return typeof input === 'number' && Number.isInteger(input) && input >= 0 && input <= MAX_COUNT ? input : null;
}

/** The badge for a count: none at 0, the number up to 999, then "999+". */
export function badgeText(count: number): string {
  if (count <= 0) return '';
  return count > 999 ? '999+' : String(count);
}

/**
 * The badge for the focused window: its count, or, while no window of the app is focused (another
 * app is in front), the count of the window focused last. Windows that have not reported count 0.
 */
export function badgeFor(counts: ReadonlyMap<number, number>, focused: number | null, lastFocused: number | null): string {
  const id = focused ?? lastFocused;
  return badgeText(id === null ? 0 : (counts.get(id) ?? 0));
}

export interface DockActions {
  newWindow: () => void;
}

/** The Dock menu: "New Window" runs Open Product Folder. macOS lists the recent folders above it. */
export function dockMenuTemplate(actions: DockActions): MenuItemConstructorOptions[] {
  return [{ label: 'New Window', click: actions.newWindow }];
}
