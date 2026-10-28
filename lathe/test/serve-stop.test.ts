// A server stopped while a reload is in progress, and the process exiting straight after, as the desktop app's quit
// does. Each round runs serve() in a worker thread and ends the thread once stop() resolves: ending a thread frees its
// Node environment, as Electron's quit does, so DuckDB work still running then ends the whole process with
// "terminating due to uncaught exception of type Napi::Error". The rounds run in a child process, so such an end
// fails this test instead of the test run.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const SERVE_MODULE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'server', 'serve.ts');
const temp = mkdtempSync(path.join(tmpdir(), 'lathe-serve-stop-'));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

// One round, in a worker: serve, load, touch a data file and ask for the specs again (a reload, as an edit makes),
// wait `delay` ms, stop, and end the thread.
const ROUND = `
import { workerData, parentPort } from 'node:worker_threads';
import { utimesSync } from 'node:fs';
try {
  const { serve } = await import(workerData.serveModule);
  const running = serve({ root: workerData.root, port: 0, appDir: workerData.appDir });
  await new Promise((resolve, reject) => { running.server.once('listening', resolve); running.server.once('error', reject); });
  const url = 'http://127.0.0.1:' + running.server.address().port;
  await (await fetch(url + '/api/spec')).arrayBuffer();
  const later = new Date(Date.now() + 1000 * (workerData.round + 1));
  utimesSync(workerData.dataFile, later, later);
  let answered = false;
  fetch(url + '/api/spec').then((res) => res.arrayBuffer()).then(() => { answered = true; }, () => {});
  await new Promise((resolve) => setTimeout(resolve, workerData.delay));
  const inProgress = !answered;
  await running.stop();
  parentPort.postMessage({ inProgress });
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
`;

// The rounds, one after another, in the child process; it prints each round's result as JSON.
const ROUNDS = `
import { Worker } from 'node:worker_threads';
const options = JSON.parse(process.env.LATHE_STOP_ROUNDS);
const rounds = [];
for (const [round, delay] of options.delays.entries()) {
  const worker = new Worker(${JSON.stringify(ROUND)}, { eval: true, workerData: { ...options, round, delay } });
  let inProgress = null;
  worker.on('message', (m) => { inProgress = m.inProgress; });
  const code = await new Promise((resolve) => worker.once('exit', resolve));
  rounds.push({ delay, code, inProgress });
}
console.log(JSON.stringify(rounds));
`;

describe('A server stops cleanly, even while a reload is in progress', () => {
  it('LA-PLT-UC02-R06-T01 waits for the reload in progress and closes the database, so the process exits cleanly', () => {
    const root = path.join(temp, 'product');
    const appDir = path.join(temp, 'app');
    mkdirSync(path.join(root, 'data'), { recursive: true });
    mkdirSync(appDir);
    writeFileSync(path.join(appDir, 'index.html'), '<!doctype html><title>Lathe</title>\n');
    writeFileSync(path.join(root, 'lathe.config.json'), '{}\n');
    writeFileSync(path.join(root, 'data', 'product.jsonl'), '{"id":"STP","title":"Stop Shop","description":"A product for the stop test."}\n');
    const dataFile = path.join(root, 'data', 'domain.jsonl');
    writeFileSync(dataFile, '{"id":"STP-ORD","title":"Orders","product_id":"STP","subdomain_type":"core","description":"Orders."}\n');

    // From a stop as the reload begins to one after it has finished, when only the close itself is left.
    const delays = [0, 5, 10, 20, 40, 80, 2_000];
    const env = { ...process.env, LATHE_STOP_ROUNDS: JSON.stringify({ serveModule: SERVE_MODULE, root, appDir, dataFile, delays }) };
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', ROUNDS], { env, encoding: 'utf8', timeout: 120_000 });

    expect({ status: child.status, signal: child.signal, stderr: child.stderr }).toEqual({ status: 0, signal: null, stderr: '' });
    const rounds = JSON.parse(child.stdout.trim().split('\n').at(-1)!) as { delay: number; code: number; inProgress: boolean }[];
    expect(rounds.map((r) => r.code)).toEqual(delays.map(() => 0));
    // The early rounds stopped while the reload was still running; the last one after it had finished.
    expect(rounds[0].inProgress).toBe(true);
    expect(rounds.at(-1)!.inProgress).toBe(false);
  }, 150_000);
});
