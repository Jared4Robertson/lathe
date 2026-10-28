// The smoke run (test/smoke.test.ts): with LATHE_DESKTOP_SMOKE set to a file, the shell opens the
// folder in a hidden window, notes the launch view over it, waits for the page and its GET /api/spec
// and for the launch view to lift, checks the app's own title bar and the chrome colors it sent, notes
// the Dock icon, reads the application menu and runs View › Show or Hide Navigation by its command ID, chooses
// Help › Keyboard Shortcuts, starts a reload by touching a data file and asking for the specs,
// writes what it saw to that file as JSON, and quits while that reload is in progress.
import { Menu, type BrowserWindow } from 'electron';
import { readdirSync, utimesSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Chrome } from './chrome.ts';

export interface SmokeResult {
  url?: string;
  title?: string;
  apiSpecStatus?: number;
  text?: string;
  bridge?: { keys: string[]; isDesktop: unknown; hasOnCommand: unknown; nodeInPage: boolean };
  /** The window's titleBarStyle option. */
  titleBarStyle?: string;
  /** What the app's title bar showed: its height, its command center's text and its controls' names. */
  titleBar?: { height: number; center: string; buttons: string[] } | null;
  /** The chrome the page sent through setChrome, as the main process applied it. */
  chrome?: Chrome;
  shortcutsOpened?: boolean;
  /** The application menu: its top-level labels, and the labels in View. */
  menu?: { top: string[]; view: string[] };
  /** Whether the navigation was shown before View › Show or Hide Navigation ran, and after. */
  navShown?: { before: boolean; after: boolean };
  /** The launch view: the text it showed before the page loaded, and whether it lifted once the specs came. */
  launch?: { seen?: string; lifted: boolean };
  /** The Dock icon the unpacked app set, with its size in pixels. */
  dockIcon?: { file: string; width: number; height: number } | null;
  /** Whether a reload (a data file touched, the specs asked for) was still in progress when the run quit. */
  reloadAtQuit?: boolean;
  error?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function until<T>(read: () => Promise<T>, ok: (value: T) => boolean, timeout = 30_000): Promise<T> {
  const end = Date.now() + timeout;
  let value = await read();
  while (!ok(value) && Date.now() < end) {
    await sleep(250);
    value = await read();
  }
  return value;
}

export function smokeFile() {
  return process.env.LATHE_DESKTOP_SMOKE || null;
}

export function writeSmoke(file: string, result: SmokeResult) {
  writeFileSync(file, JSON.stringify(result, null, 2));
}

/**
 * Watches one window through the run. Call it before the window loads, so the page's first
 * GET /api/spec is seen; `runCommand` sends a menu command to it.
 */
export async function runSmoke(
  win: BrowserWindow,
  expect: string,
  runCommand: (id: string) => void,
  frame: {
    titleBarStyle: string;
    chrome: () => Chrome | undefined;
    launch: () => { seen?: string; showing: boolean };
    dockIcon: () => { file: string; width: number; height: number } | null;
  },
): Promise<SmokeResult> {
  const result: SmokeResult = { titleBarStyle: frame.titleBarStyle, dockIcon: frame.dockIcon() };
  const spec = new Promise<number>((resolve) => {
    win.webContents.session.webRequest.onCompleted({ urls: ['*://*/api/spec*'] }, (details) => resolve(details.statusCode));
  });
  const loaded = new Promise<void>((resolve) => win.webContents.once('did-finish-load', () => resolve()));
  const js = <T>(code: string) => win.webContents.executeJavaScript(code) as Promise<T>;
  await loaded;
  result.url = win.webContents.getURL();
  result.apiSpecStatus = await Promise.race([spec, sleep(30_000).then(() => 0)]);
  result.text = await until(() => js<string>('document.body.innerText'), (text) => text.includes(expect));
  result.title = win.getTitle();
  const launch = await until(async () => frame.launch(), (l) => !l.showing, 10_000);
  result.launch = { seen: launch.seen, lifted: !launch.showing };
  result.bridge = await js(`({
    keys: Object.keys(window.latheDesktop ?? {}).sort(),
    isDesktop: window.latheDesktop?.isDesktop,
    hasOnCommand: typeof window.latheDesktop?.onCommand === 'function',
    nodeInPage: typeof window.require !== 'undefined' || typeof window.process !== 'undefined' || typeof window.module !== 'undefined',
  })`);
  result.titleBar = await js(`(() => {
    const bar = document.querySelector('.desktop-title-bar');
    if (!bar) return null;
    return {
      height: Math.round(bar.getBoundingClientRect().height),
      center: bar.querySelector('.command-center')?.textContent ?? '',
      buttons: [...bar.querySelectorAll('button')].map((b) => b.getAttribute('aria-label')),
    };
  })()`);
  result.chrome = await until(async () => frame.chrome(), Boolean, 10_000);
  const items = Menu.getApplicationMenu()?.items ?? [];
  result.menu = {
    top: items.map((i) => i.label),
    view: items.find((i) => i.label === 'View')?.submenu?.items.map((i) => i.label).filter(Boolean) ?? [],
  };
  // The hidden window is never the focused one, which a click on the menu item sends to, so the run sends the item's
  // command ID to it as that click does.
  const navShown = () => js<boolean>("!document.querySelector('.app')?.classList.contains('nav-collapsed')");
  const before = await navShown();
  runCommand('toggleNav');
  result.navShown = { before, after: await until(navShown, (shown) => shown !== before, 10_000) };
  runCommand('showShortcuts');
  result.shortcutsOpened = await until(() => js<boolean>('!!document.querySelector(\'[role="dialog"][aria-label="Keyboard shortcuts"]\')'), Boolean, 10_000);
  return result;
}

/**
 * Starts a reload, as an edit does: touches the folder's data files, which the server's watcher sees, and asks for
 * the specs, which loads them afresh. Resolves, a moment later, to whether that answer is still to come.
 */
export async function reloadInProgress(url: string, folder: string): Promise<boolean> {
  const data = path.join(folder, 'data');
  const later = new Date(Date.now() + 2_000);
  for (const file of readdirSync(data).filter((f) => f.endsWith('.jsonl'))) utimesSync(path.join(data, file), later, later);
  let answered = false;
  void fetch(`${url}/api/spec`).then((res) => res.arrayBuffer()).then(() => (answered = true), () => undefined);
  await sleep(20);
  return !answered;
}
