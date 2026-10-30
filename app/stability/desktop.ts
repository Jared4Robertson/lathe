import type { Page } from '@playwright/test';
import { desktopStandIn } from '../test/desktop-bridge';

// The desktop app in a browser: the shell's bridge (window.latheDesktop) stood in for before the page loads, so the
// app shows what it shows in the desktop app (its tab strip, LA-V96-R10..R17, R31). Every suite uses this one
// stand-in (test/desktop-bridge.ts, typed by the bridge itself); a test changes only the members it watches.

/** Changes the stand-in's members in the page, before the app loads; `arg` is sent to the page as JSON. */
type Customize<A> = (bridge: LatheDesktop, arg: A) => void;

/** Makes the next pages load as the desktop app's, with `customize` run on the bridge first. */
export async function asDesktop<A = null>(page: Page, customize?: Customize<A>, arg?: A) {
  const then = customize ? `(${customize.toString()})(window.latheDesktop, ${JSON.stringify(arg ?? null)});` : '';
  await page.addInitScript(`window.latheDesktop = (${desktopStandIn.toString()})();${then}`);
}
