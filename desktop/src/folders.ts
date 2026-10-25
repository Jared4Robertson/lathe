// Product folders: whether a folder can be opened, the names of the products in it, and the
// recent folders list (File › Open Recent). Nothing here touches Electron, so it is unit-tested.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const CONFIG_FILE = 'lathe.config.json';
/** How many folders File › Open Recent lists. */
export const RECENT_LIMIT = 10;

export type FolderCheck = { ok: true; specsDir: string } | { ok: false; message: string };

const isDir = (p: string) => existsSync(p) && statSync(p).isDirectory();

/**
 * A folder opens when it holds a lathe.config.json (valid JSON), or else a specs/ folder.
 * Otherwise the message says what is missing.
 */
export function checkFolder(folder: string): FolderCheck {
  if (!isDir(folder)) return { ok: false, message: `${folder} is not a folder.` };
  const config = path.join(folder, CONFIG_FILE);
  if (existsSync(config)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(config, 'utf8'));
    } catch (error) {
      return { ok: false, message: `${CONFIG_FILE} in ${folder} is not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
    }
    const specs = parsed && typeof parsed === 'object' && typeof (parsed as { specs?: unknown }).specs === 'string' ? (parsed as { specs: string }).specs : 'specs';
    return { ok: true, specsDir: path.resolve(folder, specs) };
  }
  if (isDir(path.join(folder, 'specs'))) return { ok: true, specsDir: path.join(folder, 'specs') };
  return {
    ok: false,
    message: `${folder} has no ${CONFIG_FILE} and no specs folder. Choose the root of a product repo: the folder that holds ${CONFIG_FILE}, or its specs folder's parent.`,
  };
}

/** The title of each product record (specs/<product>/product.md), in folder order. */
export function productNames(specsDir: string): string[] {
  if (!isDir(specsDir)) return [];
  const names: string[] = [];
  for (const entry of readdirSync(specsDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(specsDir, entry.name, 'product.md');
    if (!entry.isDirectory() || !existsSync(file)) continue;
    const header = readFileSync(file, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const title = header?.[1].match(/^title:\s*(.+)$/m)?.[1].trim().replace(/^(["'])(.*)\1$/, '$2');
    if (title) names.push(title);
  }
  return names;
}

/** A folder as people read it: under the home folder it starts with "~". */
export function displayPath(folder: string, home = os.homedir()): string {
  return folder === home || folder.startsWith(home + path.sep) ? '~' + folder.slice(home.length) : folder;
}

/** The window title: the products' names, then the folder. */
export function windowTitle(folder: string, names: string[], home = os.homedir()): string {
  const where = displayPath(folder, home);
  return names.length ? `${names.join(', ')} — ${where}` : `${path.basename(folder)} — ${where}`;
}

/** The recent list with `folder` first, each folder once, at most RECENT_LIMIT long. */
export function addRecent(list: readonly string[], folder: string, limit = RECENT_LIMIT): string[] {
  const key = path.resolve(folder);
  return [key, ...list.filter((f) => path.resolve(f) !== key)].slice(0, limit);
}

/** Reads a saved recent list, keeping only strings, each once, at most RECENT_LIMIT. */
export function parseRecent(raw: unknown, limit = RECENT_LIMIT): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((f): f is string => typeof f === 'string' && f.length > 0).reduceRight<string[]>((list, f) => addRecent(list, f, limit), []);
}
