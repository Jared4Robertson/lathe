// Runs the real shell, hidden, on a small product folder (src/smoke.ts). macOS only: on Linux,
// Electron needs a display server (xvfb) that CI does not have, and Windows is not built yet.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import electronPath from 'electron';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SmokeResult } from '../src/smoke.ts';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lathe = path.join(desktop, '..', 'lathe');
const temp = mkdtempSync(path.join(os.tmpdir(), 'lathe-desktop-smoke-'));
const product = path.join(temp, 'product');

function write(file: string, text: string) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
}

beforeAll(() => {
  if (!existsSync(path.join(lathe, 'dist', 'app', 'index.html')) || !existsSync(path.join(lathe, 'dist', 'src', 'server', 'serve.js'))) {
    execFileSync('npm', ['--prefix', lathe, 'run', 'build'], { stdio: 'inherit' });
  }
  execFileSync(path.join(desktop, 'node_modules', '.bin', 'tsc'), ['-p', 'tsconfig.build.json'], { cwd: desktop, stdio: 'inherit' });
  write(path.join(product, 'lathe.config.json'), '{}\n');
  write(path.join(product, 'specs', 'smoke', 'product.md'), '---\nid: SMK\nkind: product\ntitle: Smoke Shop\n---\nA product for the desktop smoke test.\n');
  write(path.join(product, 'specs', 'smoke', 'orders', 'domain.md'), '---\nid: SMK-ORD\nkind: domain\ntitle: Orders\nparent: SMK\n---\nOrders.\n');
}, 300_000);

afterAll(() => rmSync(temp, { recursive: true, force: true }));

describe.skipIf(process.platform !== 'darwin')('LA-DSK-T06 The desktop app opens a product folder in a window, bridges only window.latheDesktop and runs a menu command', () => {
  it('shows the product, answers GET /api/spec, names the window, draws its own title bar and runs Help › Keyboard Shortcuts', async () => {
    const resultFile = path.join(temp, 'result.json');
    const env: NodeJS.ProcessEnv = { ...process.env, LATHE_DESKTOP_SMOKE: resultFile, LATHE_DESKTOP_USER_DATA: path.join(temp, 'user-data') };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.LATHE_DESKTOP_DEV;
    const child = spawn(electronPath as unknown as string, ['.', product], { cwd: desktop, env, stdio: 'inherit' });
    const code = await new Promise<number | null>((resolve) => {
      const timer = setTimeout(() => child.kill(), 90_000);
      child.on('exit', (exit) => {
        clearTimeout(timer);
        resolve(exit);
      });
    });
    expect(code).toBe(0);
    const result = JSON.parse(readFileSync(resultFile, 'utf8')) as SmokeResult;
    expect(result.error).toBeUndefined();
    expect(result.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
    expect(result.url).not.toContain(':5199');
    expect(result.apiSpecStatus).toBe(200);
    expect(result.text).toContain('Smoke Shop');
    expect(result.title).toBe(`Smoke Shop — ${product.replace(os.homedir(), '~')}`);
    expect(result.bridge).toEqual({ keys: ['isDesktop', 'onCommand', 'platform', 'setChrome'], isDesktop: true, hasOnCommand: true, nodeInPage: false });
    // No system title bar: the app draws its own, and its theme's colors reach the window.
    expect(result.titleBarStyle).toBe('hidden');
    expect(result.titleBar?.height).toBe(38);
    expect(result.titleBar?.center).toMatch(/^Lathe/);
    expect(result.titleBar?.buttons).toEqual(['Go back', 'Go forward', expect.stringMatching(/^Lathe.*Quick find$/), 'Show or hide the navigation', 'Show or hide the inspector']);
    expect(result.chrome?.background).toMatch(/^#[0-9A-F]{6}$/);
    expect(result.chrome?.foreground).toMatch(/^#[0-9A-F]{6}$/);
    expect(result.shortcutsOpened).toBe(true);
    const recent = JSON.parse(readFileSync(path.join(temp, 'user-data', 'recent-folders.json'), 'utf8'));
    expect(recent).toEqual([product]);
  }, 120_000);
});
