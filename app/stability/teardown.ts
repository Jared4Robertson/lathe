import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

// Removes the copy of the specs the suite served (app/stability/playwright.config.ts).
export default function teardown() {
  const root = process.env.STABILITY_ROOT;
  if (root && root.startsWith(tmpdir())) rmSync(root, { recursive: true, force: true });
}
