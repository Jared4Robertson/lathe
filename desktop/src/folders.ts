// Product folders: whether a folder can be opened, the names of the products in it, and how a folder
// reads to people. A folder's config and its products' titles are read with Lathe's own config module (config.ts), the
// app's own Lathe's, before the folder's engine starts. Nothing here touches Electron, so it is unit-tested. The recent
// folders are their own aggregate (recent-folders/).
import { existsSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type * as LatheConfigModule from 'lathe-config';

/** What the shell reads with Lathe's config module: a folder's config and the titles of the products in a data folder. */
export type LatheConfigReads = Pick<typeof LatheConfigModule, 'CONFIG_FILE' | 'readConfig' | 'productTitles'>;

/**
 * Where the app's own Lathe keeps its config module: built, inside the packed app; else this repo's source, which
 * Electron's Node runs as it is (it strips the types).
 */
export function latheConfigModulePath(repoRoot: string, packaged: { resourcesPath: string } | null): string {
  return packaged
    ? path.join(packaged.resourcesPath, 'node_modules', '@jaredrob', 'lathe', 'dist', 'src', 'config.js')
    : path.join(repoRoot, 'lathe', 'src', 'config.ts');
}

/** Lathe's config module, from its file. */
export async function loadLatheConfig(modulePath: string): Promise<LatheConfigReads> {
  return (await import(pathToFileURL(modulePath).href)) as LatheConfigReads;
}

/** A folder that opens: its data folder, then the data folder of each other product its config lists under products. */
export type FolderCheck = { ok: true; dataDirs: string[] } | { ok: false; message: string };

const isDir = (p: string) => existsSync(p) && statSync(p).isDirectory();

/**
 * A folder opens when it holds a lathe.config.json, or else a data/ folder. Lathe reads the config as every load does
 * (its data folder, data by default, and the products it lists, each with a config of its own), and a config it refuses
 * is refused here with its reason, so the window never opens on a folder its engine cannot read. Otherwise the message
 * says what is missing.
 */
export function checkFolder(folder: string, lathe: LatheConfigReads): FolderCheck {
  if (!isDir(folder)) return { ok: false, message: `${folder} is not a folder.` };
  if (!existsSync(path.join(folder, lathe.CONFIG_FILE)) && !isDir(path.join(folder, 'data'))) {
    return {
      ok: false,
      message: `${folder} has no ${lathe.CONFIG_FILE} and no data folder. Choose the root of a product repo: the folder that holds ${lathe.CONFIG_FILE}, or its data folder's parent.`,
    };
  }
  try {
    const own = lathe.readConfig(folder);
    return { ok: true, dataDirs: [own.dataDir, ...own.products.map((product) => lathe.readConfig(product).dataDir)] };
  } catch (error) {
    return { ok: false, message: `${folder}: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/** The title of each product in the data folders, folder by folder, each in its product.jsonl's order, which is by ID. */
export function productNames(dataDirs: readonly string[], lathe: LatheConfigReads): string[] {
  return dataDirs.flatMap((dataDir) => lathe.productTitles(dataDir));
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
