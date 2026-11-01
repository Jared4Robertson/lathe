// One instance (LA-STD-EXPERIENCE-R09): the app holds a single-instance lock, so a second launch hands its
// command line to the running app, and a folder opened through Finder or the Dock arrives as an
// open-file event. Both route here: open (or focus) that folder's window, or bring the app forward.
import path from 'node:path';

/** The folder named on a command line (`electron . ~/Development/tool-library`), if any. */
export function folderArgument(argv: readonly string[], packaged: boolean): string | undefined {
  const args = argv.slice(packaged ? 1 : 2).filter((a) => !a.startsWith('-'));
  return args.at(-1);
}

export type Route = { kind: 'open'; folder: string } | { kind: 'focus' };

/**
 * What a second launch does: open its folder (openFolder focuses the folder's window when it is
 * already open), or, with no folder, bring the app's front window forward. A relative folder is
 * read from the second launch's working directory.
 */
export function routeSecondInstance(argv: readonly string[], workingDirectory: string, packaged: boolean): Route {
  const named = folderArgument(argv, packaged);
  return named ? { kind: 'open', folder: path.resolve(workingDirectory, named) } : { kind: 'focus' };
}

/** What a folder opened through Finder or the Dock does: always open (or focus) it, once the app is ready. */
export function routeOpenFile(file: string, ready: boolean): { kind: 'open'; folder: string } | { kind: 'later'; folder: string } {
  const folder = path.resolve(file);
  return ready ? { kind: 'open', folder } : { kind: 'later', folder };
}

/** The window for a folder, when one is open: the same folder spelled another way still matches. */
export function windowForFolder<T>(open: ReadonlyMap<string, T>, folder: string): T | undefined {
  return open.get(path.resolve(folder));
}
