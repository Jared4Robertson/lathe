// What the plugin's scripts share: finding the Lathe repo a path is in, its data folders, and how to run its
// `lathe` command. Never through npx, so nothing is ever downloaded. The desktop app's chat names the Lathe its
// window runs in LATHE_CLI (the package's bin script, run with this Node), so the tools match the window's Lathe,
// the app's bundled copy included, whatever the folder has installed.
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

/** The Lathe bin script LATHE_CLI names, when it exists. */
const namedCli = (env) => (env.LATHE_CLI && existsSync(env.LATHE_CLI) ? env.LATHE_CLI : null);

/** How to run `lathe` for the repo at root ({ command, args, cwd }), or null when Lathe is not installed there. */
export function findLathe(root, env = process.env) {
  // The Lathe the desktop app's window runs.
  const named = namedCli(env);
  if (named) return { command: process.execPath, args: [named], cwd: root };
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

/** The folder of the Lathe package the repo at root runs: the one holding LATHE_CLI's script, else lathe/ in the Lathe repo, else node_modules/@jaredrob/lathe here or above. */
function latheDir(root, env) {
  const named = namedCli(env);
  if (named) {
    for (let dir = path.dirname(named); ; dir = path.dirname(dir)) {
      if (existsSync(path.join(dir, 'package.json'))) return dir;
      if (path.dirname(dir) === dir) return null;
    }
  }
  if (isLatheRepo(root)) return path.join(root, 'lathe');
  let dir = root;
  for (;;) {
    const installed = path.join(dir, 'node_modules', '@jaredrob', 'lathe');
    if (existsSync(path.join(installed, 'package.json'))) return installed;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

/** The Lathe installed for the repo at root: its package version and schema version (null when unknown), or null. */
export function installedLathe(root, env = process.env) {
  const dir = latheDir(root, env);
  if (!dir) return null;
  let version;
  try {
    version = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')).version;
  } catch {
    return null;
  }
  if (typeof version !== 'string') return null;
  let schema = null;
  try {
    const named = JSON.parse(readFileSync(path.join(dir, 'schema', 'version.json'), 'utf8')).schema;
    if (Number.isInteger(named)) schema = named;
  } catch {
    // A Lathe from before schema versions: its schema is unknown.
  }
  return { version, schema };
}

/** The Lathe version the plugin's skills were written for (plugin.json's lathe.version, set by each release), or null. */
export function skillsVersion(pluginDir) {
  try {
    const version = JSON.parse(readFileSync(path.join(pluginDir, '.claude-plugin', 'plugin.json'), 'utf8')).lathe?.version;
    return typeof version === 'string' && /^\d+\.\d+\.\d+/.test(version) ? version : null;
  } catch {
    return null;
  }
}

/** The warning when the installed Lathe's major version is not the major of the version the skills were written for, else null. */
export function versionWarning(installed, skills, root) {
  if (!installed || skills === null) return null;
  const major = Number(skills.split('.')[0]);
  if (Number(installed.version.split('.')[0]) === major) return null;
  const schema = installed.schema === null ? '' : ` (schema ${installed.schema})`;
  return (
    `Warning: the Lathe plugin's skills were written for Lathe ${major}.x, but ${root} has Lathe ${installed.version}${schema}. ` +
    'The tools match the installed Lathe, but the skills may name tables, columns or steps it does not have: ' +
    "update the plugin or the product's @jaredrob/lathe so their major versions match."
  );
}

/**
 * One line from the server, passed on: the first tools/call result (its ID in `calls`) gets the warning added to its
 * content, once (`state.warned`).
 */
export function warnOnce(line, calls, state) {
  if (state.warned || !line.trim()) return line;
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return line;
  }
  if (message.id === undefined || !calls.has(message.id) || !Array.isArray(message.result?.content)) return line;
  state.warned = true;
  message.result.content.push({ type: 'text', text: state.warning });
  return JSON.stringify(message);
}
