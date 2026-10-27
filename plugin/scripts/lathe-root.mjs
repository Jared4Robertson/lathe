// What the plugin's scripts share: finding the Lathe repo a path is in, its data folders, and how to run its
// `lathe` command. Never through npx, so nothing is ever downloaded.
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

export const CONFIG_FILE = 'lathe.config.json';

/** The path with its links resolved, or as given when it does not exist yet. */
export function real(p) {
  try {
    return realpathSync(p);
  } catch {
    const parent = path.dirname(p);
    return parent === p ? p : path.join(real(parent), path.basename(p));
  }
}

/** The nearest folder at or above `start` holding lathe.config.json, or null. */
export function findRoot(start) {
  let dir = start;
  for (;;) {
    if (existsSync(path.join(dir, CONFIG_FILE))) return dir;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

/** The data folders of the repo at root: the one its config names (default data/), and Lathe's own in the Lathe repo. */
export function dataDirs(root) {
  let config = {};
  try {
    config = JSON.parse(readFileSync(path.join(root, CONFIG_FILE), 'utf8'));
  } catch {
    // An unreadable config: Lathe itself reports it; the default folder still holds the data.
  }
  const dirs = [real(path.resolve(root, typeof config.data === 'string' ? config.data : 'data'))];
  if (isLatheRepo(root)) dirs.push(real(path.join(root, 'lathe', 'data')));
  return dirs;
}

/** Whether root is the Lathe repo itself, where the CLI runs from source. */
export const isLatheRepo = (root) => existsSync(path.join(root, 'lathe', 'bin', 'lathe.ts'));

/** How to run `lathe` for the repo at root ({ command, args, cwd }), or null when Lathe is not installed there. */
export function findLathe(root) {
  // The Lathe repo: the CLI from source, as `npm --prefix lathe run lathe` runs it, without npm's start-up cost.
  if (isLatheRepo(root) && existsSync(path.join(root, 'lathe', 'node_modules'))) {
    return { command: process.execPath, args: [path.join(root, 'lathe', 'bin', 'lathe.ts')], cwd: path.join(root, 'lathe') };
  }
  // A product repo with Lathe installed: the package's bin, here or in a parent workspace.
  let dir = root;
  for (;;) {
    const bin = path.join(dir, 'node_modules', '.bin', process.platform === 'win32' ? 'lathe.cmd' : 'lathe');
    if (existsSync(bin)) return { command: bin, args: [], cwd: root };
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}
