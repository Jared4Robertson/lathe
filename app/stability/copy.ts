import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, lstatSync } from 'node:fs';
import path from 'node:path';

// The browser suites' copy of this repo: every file git knows of (tracked, or new and not ignored), so the copy is
// the product as it is, its code and manifests included, and `lathe check` finds there what it finds here. A copy of
// the data alone would miss every file the spec names. Packages (node_modules) and build output are never copied.

/** Copies the repo at `repo` into the empty folder `root`. */
export function copyRepo(repo: string, root: string) {
  const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: repo, maxBuffer: 64 * 1024 * 1024 })
    .toString().split('\0').filter(Boolean);
  for (const file of files) {
    const from = path.join(repo, file);
    if (existsSync(from) && lstatSync(from).isFile()) cpSync(from, path.join(root, file));
  }
}
