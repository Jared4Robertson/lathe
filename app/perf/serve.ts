// The performance suite's server (LA-PAT-APP-UX-R11): builds the app for production into a temporary
// folder, writes the build's chunk sizes to perf/results/bundle.json, and serves the build with
// `lathe serve`'s server over the copy of the data that perf/playwright.config.ts made, on the
// port it chose (never 5199), and the large product (lathe/perf/large-product.ts) on a second port. The budgets are judged on the production build, which is what a
// product's `lathe serve` and the desktop app ship.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';
import { serve } from '../../lathe/src/server/serve.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PERF_PORT);
const root = process.env.PERF_ROOT;
if (!port || port === 5199 || !root) throw new Error('perf/serve.ts needs PERF_PORT (not 5199) and PERF_ROOT, from perf/playwright.config.ts.');

const outDir = mkdtempSync(path.join(tmpdir(), 'lathe-perf-app-'));
await build({ root: path.resolve(here, '..'), logLevel: 'warn', build: { outDir, emptyOutDir: true, minify: process.env.PERF_MINIFY !== '0' } });

// Each JavaScript file the build made, with its size and gzipped size, and the ones index.html loads at once.
const assets = path.join(outDir, 'assets');
const html = readFileSync(path.join(outDir, 'index.html'), 'utf8');
const chunks = readdirSync(assets).filter((f) => f.endsWith('.js')).map((file) => {
  const body = readFileSync(path.join(assets, file));
  return { file, bytes: statSync(path.join(assets, file)).size, gzip: gzipSync(body).length, initial: html.includes(`/assets/${file}`) };
});
mkdirSync(path.join(here, 'results'), { recursive: true });
writeFileSync(path.join(here, 'results/bundle.json'), JSON.stringify({ outDir, chunks }, null, 2));

serve({ root, port, appDir: outDir });
console.log(`perf server on http://127.0.0.1:${port}/`);
// The large product the big-map scenarios measure (lathe/perf/large-product.ts), from the same build on its own port.
const largePort = Number(process.env.PERF_LARGE_PORT);
const largeRoot = process.env.PERF_LARGE_ROOT;
if (largePort && largePort !== 5199 && largeRoot) {
  serve({ root: largeRoot, port: largePort, appDir: outDir });
  console.log(`perf server for the large product on http://127.0.0.1:${largePort}/`);
}
