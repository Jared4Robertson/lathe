// The smoke run (test/smoke.test.ts): with LATHE_DESKTOP_SMOKE set to a file, the shell opens the
// folder in a hidden window, waits for the page and its GET /api/spec, checks the app's own title
// bar and the chrome colors it sent, chooses Help › Keyboard Shortcuts, writes what it saw to that
// file as JSON, and quits.
import type { BrowserWindow } from 'electron';
import { writeFileSync } from 'node:fs';
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
  frame: { titleBarStyle: string; chrome: () => Chrome | undefined },
): Promise<SmokeResult> {
  const result: SmokeResult = { titleBarStyle: frame.titleBarStyle };
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
  runCommand('showShortcuts');
  result.shortcutsOpened = await until(() => js<boolean>('!!document.querySelector(\'[role="dialog"][aria-label="Keyboard shortcuts"]\')'), Boolean, 10_000);
  return result;
}
