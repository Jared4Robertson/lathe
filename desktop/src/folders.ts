// Product folders: whether a folder can be opened, the names of the products in it, and how a folder
// reads to people. Nothing here touches Electron, so it is unit-tested. The recent folders are their own
// aggregate (recent-folders/).
import { existsSync, readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const CONFIG_FILE = 'lathe.config.json';

/** A folder that opens: its data folder, then the data folder of each other product its config lists under products. */
export type FolderCheck = { ok: true; dataDirs: string[] } | { ok: false; message: string };

const isDir = (p: string) => existsSync(p) && statSync(p).isDirectory();

type Config = { data?: unknown; products?: unknown };

// A folder's config, or why it cannot be read.
function readConfig(folder: string): { config: Config } | { message: string } {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path.join(folder, CONFIG_FILE), 'utf8'));
    return { config: parsed && typeof parsed === 'object' ? (parsed as Config) : {} };
  } catch (error) {
    return { message: `${CONFIG_FILE} in ${folder} is not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
}

const dataOf = (folder: string, config: Config) => path.resolve(folder, typeof config.data === 'string' ? config.data : 'data');

/**
 * A folder opens when it holds a lathe.config.json (valid JSON, whose "data" names the data folder, data by
 * default, and whose "products" lists the folders of the other products the workspace shows), or else a data/
 * folder. Otherwise the message says what is missing. A listed folder's own config gives its data folder; one that
 * cannot be read is left for the server to report when it loads the workspace.
 */
export function checkFolder(folder: string): FolderCheck {
  if (!isDir(folder)) return { ok: false, message: `${folder} is not a folder.` };
  if (existsSync(path.join(folder, CONFIG_FILE))) {
    const own = readConfig(folder);
    if ('message' in own) return { ok: false, message: own.message };
    const listed = Array.isArray(own.config.products) ? own.config.products.filter((p): p is string => typeof p === 'string') : [];
    const others = listed.flatMap((p) => {
      const product = path.resolve(folder, p);
      const read = existsSync(path.join(product, CONFIG_FILE)) ? readConfig(product) : null;
      return read && 'config' in read ? [dataOf(product, read.config)] : [];
    });
    return { ok: true, dataDirs: [dataOf(folder, own.config), ...others] };
  }
  if (isDir(path.join(folder, 'data'))) return { ok: true, dataDirs: [path.join(folder, 'data')] };
  return {
    ok: false,
    message: `${folder} has no ${CONFIG_FILE} and no data folder. Choose the root of a product repo: the folder that holds ${CONFIG_FILE}, or its data folder's parent.`,
  };
}

/** The title of each product (the rows of each data folder's product.jsonl), folder by folder, each file in its order, which is by ID. */
export function productNames(dataDirs: readonly string[]): string[] {
  return dataDirs.flatMap(productNamesIn);
}

function productNamesIn(dataDir: string): string[] {
  const file = path.join(dataDir, 'product.jsonl');
  if (!existsSync(file)) return [];
  const names: string[] = [];
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const title = (JSON.parse(line) as { title?: unknown }).title;
      if (typeof title === 'string' && title.trim()) names.push(title.trim());
    } catch {
      // A line that is not JSON names no product; the server reports it when it loads the folder.
    }
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
