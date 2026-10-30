// `npm --prefix desktop run dev`: builds the shell, starts Electron in development mode
// (LATHE_DESKTOP_DEV=1, so windows load the app's Vite dev server and app changes hot-reload),
// and rebuilds and restarts Electron whenever the main process or preload changes.
// Arguments are passed on: `npm --prefix desktop run dev -- ~/Development/tool-library`.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import electronPath from 'electron';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tsc = path.join(desktop, 'node_modules', '.bin', 'tsc');
const args = process.argv.slice(2);

const build = () => spawnSync(tsc, ['-p', 'tsconfig.build.json'], { cwd: desktop, stdio: 'inherit' }).status === 0;
// The chat's speech helper, once at the start (scripts/speech.ts builds it only when its source changed).
spawnSync(process.execPath, [path.join(desktop, 'scripts', 'speech.ts')], { cwd: desktop, stdio: 'inherit' });

let electron: ChildProcess | null = null;
let restarting = false;

function start() {
  electron = spawn(electronPath as unknown as string, ['.', ...args], { cwd: desktop, stdio: 'inherit', env: { ...process.env, LATHE_DESKTOP_DEV: '1' } });
  electron.on('exit', (code) => {
    if (restarting) return;
    process.exit(code ?? 0);
  });
}

async function restart() {
  if (!build()) return console.log('[dev] Build failed; Electron keeps running the last build.');
  restarting = true;
  if (electron && electron.exitCode === null) {
    const exited = new Promise((resolve) => electron!.once('exit', resolve));
    electron.kill();
    await exited;
  }
  restarting = false;
  console.log('[dev] Restarting Electron.');
  start();
}

if (!build()) process.exit(1);
start();

let timer: NodeJS.Timeout | undefined;
watch(path.join(desktop, 'src'), { recursive: true }, () => {
  clearTimeout(timer);
  timer = setTimeout(() => void restart(), 200);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    restarting = true;
    electron?.kill();
    process.exit(0);
  });
}
