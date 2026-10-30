// Recent folders (LA-PLT-A9): the folders opened last, latest first, each once, at most RECENT_LIMIT, which one
// list serves every window (File › Open Recent, and the folder a launch opens).
import path from 'node:path';

/** How many folders File › Open Recent lists. */
export const RECENT_LIMIT = 10;

/** The recent folders, latest first. */
/** One recent folder: its full path. */
export type RecentFolder = string;

export type RecentFolders = readonly RecentFolder[];

/** The recent list with `folder` first, each folder once, at most RECENT_LIMIT long. */
export function addRecent(list: RecentFolders, folder: string, limit = RECENT_LIMIT): string[] {
  const key = path.resolve(folder);
  return [key, ...list.filter((f) => path.resolve(f) !== key)].slice(0, limit);
}

/** Reads a saved recent list, keeping only strings, each once, at most RECENT_LIMIT. */
export function parseRecent(raw: unknown, limit = RECENT_LIMIT): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((f): f is string => typeof f === 'string' && f.length > 0).reduceRight<string[]>((list, f) => addRecent(list, f, limit), []);
}
