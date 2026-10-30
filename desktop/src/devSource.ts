// Where a window loads the app from in development (`npm --prefix desktop run dev`): the owner's own
// Vite dev server on port 5199 when it answers for the same product folder, so app changes
// hot-reload exactly as in the browser and his server is shared; otherwise a Vite dev server of the
// shell's own, on a free port, reading the opened folder.
import { spawn, type ChildProcess } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';

/** The owner's dev server. The shell only ever connects to it; it never starts anything on it. */
export const SHARED_PORT = 5199;
export const SHARED_URL = `http://localhost:${SHARED_PORT}`;
/** The header the app's dev server (app/server/lathe.ts) names its product folder in. */
export const ROOT_HEADER = 'x-lathe-root';

export type Probe = (url: string) => Promise<{ status: number; headers: Record<string, string | undefined> } | null>;
export type DevSource = { kind: 'shared'; url: string } | { kind: 'own' };

const same = (a: string, b: string) => {
  const real = (p: string) => {
    try {
      return realpathSync(p);
    } catch {
      return path.resolve(p);
    }
  };
  return real(a) === real(b);
};

/**
 * The shared server when GET /api/product/list-products on 5199 answers 200 and its product folder (the
 * x-lathe-root header, or `repoRoot` from a server that predates the header) is `folder`.
 */
export async function chooseDevSource(folder: string, repoRoot: string, probe: Probe): Promise<DevSource> {
  const answer = await probe(`${SHARED_URL}/api/product/list-products`);
  if (!answer || answer.status !== 200) return { kind: 'own' };
  const root = answer.headers[ROOT_HEADER] ? decodeURIComponent(answer.headers[ROOT_HEADER]!) : repoRoot;
  return same(root, folder) ? { kind: 'shared', url: SHARED_URL } : { kind: 'own' };
}

/** Asks a URL with a short timeout; null when nothing answers. */
export const httpProbe: Probe = async (url) => {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
    await res.body?.cancel();
    return { status: res.status, headers: Object.fromEntries(res.headers.entries()) };
  } catch {
    return null;
  }
};

/** A free local port, never 5199. */
export async function freePort(avoid: readonly number[] = [SHARED_PORT]): Promise<number> {
  for (let tries = 0; tries < 20; tries++) {
    const port = await new Promise<number>((resolve, reject) => {
      const server = createServer();
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        server.close(() => resolve(typeof address === 'object' && address ? address.port : 0));
      });
    });
    if (port && !avoid.includes(port)) return port;
  }
  throw new Error('Could not find a free local port.');
}

/** Waits until a URL answers, or throws after `timeout` ms. */
export async function waitFor(url: string, timeout = 60_000, probe: Probe = httpProbe) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await probe(url)) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${url} did not answer within ${Math.round(timeout / 1000)} s.`);
}

export interface OwnDevServer {
  url: string;
  /** Stops the dev server; resolves once its process has exited. */
  stop: () => Promise<void>;
}

/**
 * Starts the app's Vite dev server (app/) on a free port with LATHE_ROOT set to the folder, so
 * latheApi serves and watches that product. It runs under the system's Node, as in the browser.
 */
export async function startOwnDevServer(repoRoot: string, folder: string, log: (line: string) => void = () => {}): Promise<OwnDevServer> {
  const appDir = path.join(repoRoot, 'app');
  const port = await freePort();
  const vite = path.join(appDir, 'node_modules', 'vite', 'bin', 'vite.js');
  const env: NodeJS.ProcessEnv = { ...process.env, LATHE_ROOT: folder };
  delete env.ELECTRON_RUN_AS_NODE;
  const child: ChildProcess = spawn('node', [vite, '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: appDir, env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout?.on('data', (d) => log(String(d)));
  child.stderr?.on('data', (d) => log(String(d)));
  const url = `http://127.0.0.1:${port}`;
  const exited = new Promise<void>((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) resolve();
    else child.once('exit', () => resolve());
  });
  const stop = () => {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    return exited;
  };
  try {
    await Promise.race([
      waitFor(url),
      new Promise((_, reject) => child.once('exit', (code) => reject(new Error(`The app's dev server stopped (exit ${code}). Run npm install in app/.`)))),
    ]);
  } catch (error) {
    await stop();
    throw error;
  }
  return { url, stop };
}
