import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Removes the copy of the data, the large product and the production build the suite served (perf/playwright.config.ts, perf/serve.ts).
export default function teardown() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const root of [process.env.PERF_ROOT, process.env.PERF_LARGE_ROOT]) if (root && root.startsWith(tmpdir())) rmSync(root, { recursive: true, force: true });
  const bundle = path.join(here, 'results/bundle.json');
  if (existsSync(bundle)) {
    const { outDir } = JSON.parse(readFileSync(bundle, 'utf8')) as { outDir?: string };
    if (outDir && outDir.startsWith(tmpdir())) rmSync(outDir, { recursive: true, force: true });
  }
}
