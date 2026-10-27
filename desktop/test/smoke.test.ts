// Runs the real shell, hidden, on a small product folder (src/smoke.ts). macOS only: on Linux,
// Electron needs a display server (xvfb) that CI does not have, and Windows is not built yet.
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import electronPath from 'electron';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { restorationDefaultsCommands } from '../src/persistence.ts';
import type { SmokeResult } from '../src/smoke.ts';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lathe = path.join(desktop, '..', 'lathe');
const temp = mkdtempSync(path.join(os.tmpdir(), 'lathe-desktop-smoke-'));
const product = path.join(temp, 'product');

function write(file: string, text: string) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
}

/** The newest change under a folder, in milliseconds, skipping dependencies and builds. */
function newest(dir: string): number {
  let latest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    latest = Math.max(latest, entry.isDirectory() ? newest(full) : statSync(full).mtimeMs);
  }
  return latest;
}

/** The engine and app build is missing, or older than a source file, so the test would run yesterday's app. */
function buildIsStale(): boolean {
  const built = [path.join(lathe, 'dist', 'app', 'index.html'), path.join(lathe, 'dist', 'src', 'server', 'serve.js')];
  if (!built.every(existsSync)) return true;
  const builtAt = Math.min(...built.map((f) => statSync(f).mtimeMs));
  const app = path.join(lathe, '..', 'app');
  return [path.join(lathe, 'src'), path.join(app, 'src'), path.join(app, 'index.html')].some((p) => existsSync(p) && (statSync(p).isDirectory() ? newest(p) : statSync(p).mtimeMs) > builtAt);
}

beforeAll(() => {
  if (buildIsStale()) {
    execFileSync('npm', ['--prefix', lathe, 'run', 'build'], { stdio: 'inherit' });
  }
  execFileSync(path.join(desktop, 'node_modules', '.bin', 'tsc'), ['-p', 'tsconfig.build.json'], { cwd: desktop, stdio: 'inherit' });
  // No macOS window restoration for the unpacked Electron, even before it runs once (src/persistence.ts).
  if (process.platform === 'darwin') for (const args of restorationDefaultsCommands()) execFileSync('defaults', args);
  write(path.join(product, 'lathe.config.json'), '{}\n');
  write(path.join(product, 'data', 'product.jsonl'), '{"id":"SMK","title":"Smoke Shop","description":"A product for the desktop smoke test."}\n');
  write(path.join(product, 'data', 'domain.jsonl'), '{"id":"SMK-ORD","title":"Orders","product_id":"SMK","subdomain_type":"core","description":"Orders."}\n');
}, 300_000);

/** Every Electron this file started; none outlives it. */
const children = new Set<ChildProcess>();
const running = (child: ChildProcess) => child.exitCode === null && child.signalCode === null;
const exited = (child: ChildProcess, ms: number) =>
  new Promise<boolean>((resolve) => {
    if (!running(child)) return resolve(true);
    const timer = setTimeout(() => resolve(false), ms);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve(true);
    });
  });

/** Stops Electron gracefully: "quit" through the smoke channel, then SIGTERM (which also quits it), then SIGKILL. */
async function stop(child: ChildProcess) {
  if (!running(child)) return;
  child.stdin?.write('quit\n');
  if (await exited(child, 10_000)) return;
  child.kill('SIGTERM');
  if (await exited(child, 5_000)) return;
  child.kill('SIGKILL');
  await exited(child, 5_000);
}

afterAll(async () => {
  for (const child of children) await stop(child);
  rmSync(temp, { recursive: true, force: true });
}, 60_000);

describe('The app icon is built for every platform', () => {
  it('LA-V71-R01-T01 has the macOS .icns, the Windows .ico, the Linux sizes and the DEV variant', () => {
    const build = path.join(desktop, 'build');
    // An .icns starts "icns", an .ico 0 0 1 0, a PNG \x89PNG.
    expect(readFileSync(path.join(build, 'icon.icns')).subarray(0, 4).toString('latin1')).toBe('icns');
    expect([...readFileSync(path.join(build, 'icon.ico')).subarray(0, 4)]).toEqual([0, 0, 1, 0]);
    for (const px of [16, 32, 48, 64, 128, 256, 512, 1024]) {
      const png = readFileSync(path.join(build, 'icons', `${px}x${px}.png`));
      expect(png.subarray(1, 4).toString('latin1')).toBe('PNG');
      // The PNG header's width and height.
      expect([png.readUInt32BE(16), png.readUInt32BE(20)], `${px} px`).toEqual([px, px]);
    }
    expect(readFileSync(path.join(build, 'icon-dev.png')).readUInt32BE(16)).toBe(1024);
  });
});

/** One run of the real shell, which every test below reads. */
let result: SmokeResult;

describe.skipIf(process.platform !== 'darwin')('The desktop app opens a product folder in a window, bridges only window.latheDesktop and runs a menu command', () => {
  beforeAll(async () => {
    const resultFile = path.join(temp, 'result.json');
    const env: NodeJS.ProcessEnv = { ...process.env, LATHE_DESKTOP_SMOKE: resultFile, LATHE_DESKTOP_USER_DATA: path.join(temp, 'user-data') };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.LATHE_DESKTOP_DEV;
    const child = spawn(electronPath as unknown as string, ['.', product], { cwd: desktop, env, stdio: ['pipe', 'inherit', 'inherit'] });
    children.add(child);
    const done = new Promise<number | null>((resolve) => child.once('exit', (exit) => resolve(exit)));
    // The run quits by itself; one that hangs is asked to quit, and killed only if it will not.
    if (!(await exited(child, 90_000))) await stop(child);
    const code = await done;
    children.delete(child);
    expect(code).toBe(0);
    result = JSON.parse(readFileSync(resultFile, 'utf8')) as SmokeResult;
    expect(result.error).toBeUndefined();
  }, 120_000);

  it('LA-PLT-PO01-T starts the window\'s own app server, which answers GET /api/spec', () => {
    expect(result.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
    expect(result.url).not.toContain(':5199');
    expect(result.apiSpecStatus).toBe(200);
  });

  it('LA-PLT-PO03-T puts the opened folder in the recent folders', () => {
    const recent = JSON.parse(readFileSync(path.join(temp, 'user-data', 'recent-folders.json'), 'utf8'));
    expect(recent).toEqual([product]);
  });

  it('LA-PLT-UC11-R02-T01 shows the product and names the window after it and its folder', () => {
    expect(result.text).toContain('Smoke Shop');
    expect(result.title).toBe(`Smoke Shop — ${product.replace(os.homedir(), '~')}`);
  });

  it('LA-PLT-UC11-R05-T01 bridges only window.latheDesktop, with no Node in the page', () => {
    expect(result.bridge?.keys).toEqual(['copyRecordId', 'isDesktop', 'onCommand', 'onFullScreen', 'openRecordInEditor', 'platform', 'revealRecord', 'setChrome', 'setErrorCount', 'showRecordMenu']);
    expect(result.bridge?.hasOnCommand).toBe(true);
    expect(result.bridge?.nodeInPage).toBe(false);
  });

  it('LA-PLT-UC13-R03-T01 tells the page it runs in the desktop app', () => {
    expect(result.bridge?.isDesktop).toBe(true);
  });

  it('LA-V66-R02-T01 runs Help › Keyboard Shortcuts by its command ID', () => {
    expect(result.shortcutsOpened).toBe(true);
  });

  it('LA-V67-R01-T01 has no system title bar and draws its own 38 px bar', () => {
    expect(result.titleBarStyle).toBe('hidden');
    expect(result.titleBar?.height).toBe(38);
    expect(result.titleBar?.center).toMatch(/^Lathe/);
    expect(result.titleBar?.buttons).toEqual(['Go back', 'Go forward', expect.stringMatching(/^Lathe.*Quick find$/), 'Show or hide the navigation', 'Show or hide the side bar']);
  });

  it("LA-V67-R06-T01 sends the theme's chrome colors, which the main process applies", () => {
    expect(result.chrome?.background).toMatch(/^#[0-9A-F]{6}$/);
    expect(result.chrome?.foreground).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('LA-V68-R01-T01 shows the launch view, naming the product, until the page has its specs', () => {
    expect(result.launch).toEqual({ seen: 'Opening Smoke Shop…', lifted: true });
  });

  it("LA-V71-R01-T01 shows Lathe's icon in the Dock at full size", () => {
    expect(result.dockIcon).toEqual({ file: path.join(desktop, 'build', 'icon.png'), width: 1024, height: 1024 });
  });
});
