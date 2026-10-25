// The window's own pages (LA-DSK-UC05-R10, R11): a calm launch view over the window from the moment it
// opens until the page has the product's specs, and an error page when Lathe cannot load the folder.
// Both are static/launch.html, drawn over the app's page in a view of their own and given a model as
// JSON in the address; the About window is static/about.html the same way. Their buttons reach the
// main process through local-preload.cts, and parseLocalAction checks each before it runs. Pure, so
// test/launch.test.ts covers it.
import type { Chrome } from './chrome.ts';
import { displayPath } from './folders.ts';

export type LocalAction = 'retry' | 'open-another' | 'reveal' | 'open-repo' | 'open-format';

export interface PageAction {
  id: LocalAction;
  label: string;
  primary?: boolean;
}

export interface LaunchModel {
  view: 'launch' | 'error';
  heading: string;
  /** What went wrong, as the engine said it (error only). */
  message?: string;
  /** The folder, as people read it (error only). */
  folder?: string;
  actions: PageAction[];
  colors: Chrome;
}

/** The launch view: the logo and "Opening <product>…". */
export function launchModel(product: string, colors: Chrome): LaunchModel {
  return { view: 'launch', heading: `Opening ${product}…`, actions: [], colors };
}

/** The error page, with Retry, Open Another Folder and Reveal in Finder (or its name elsewhere). */
export function errorModel(product: string, folder: string, message: string, colors: Chrome, platform: NodeJS.Platform, home?: string): LaunchModel {
  const reveal = platform === 'darwin' ? 'Reveal in Finder' : platform === 'win32' ? 'Show in File Explorer' : 'Show in Folder';
  return {
    view: 'error',
    heading: `Lathe couldn't open ${product}`,
    message: message.trim() || 'The engine stopped without saying why.',
    folder: displayPath(folder, home),
    actions: [
      { id: 'retry', label: 'Retry', primary: true },
      { id: 'open-another', label: 'Open Another Folder…' },
      { id: 'reveal', label: reveal },
    ],
    colors,
  };
}

export interface AboutModel {
  name: string;
  versions: { label: string; value: string }[];
  actions: PageAction[];
  colors: Chrome;
}

/** The About window: the app, engine and Electron versions, and links to the repo and the record format. */
export function aboutModel(versions: { app: string; engine: string | null; electron: string; chrome: string; node: string }, colors: Chrome): AboutModel {
  return {
    name: 'Lathe',
    versions: [
      { label: 'Version', value: versions.app },
      { label: 'Engine', value: versions.engine ?? 'unknown' },
      { label: 'Electron', value: versions.electron },
      { label: 'Chromium', value: versions.chrome },
      { label: 'Node.js', value: versions.node },
    ],
    actions: [
      { id: 'open-repo', label: 'Source Code' },
      { id: 'open-format', label: 'Record Format' },
    ],
    colors,
  };
}

/** The repo, and its record format, which the About window links to. */
export const REPO_URL = 'https://github.com/Jared4Robertson/SDLC-RSI';
export const FORMAT_URL = `${REPO_URL}/blob/main/lathe/FORMAT.md`;

/** A button press from a local page, when it is one of the actions that page shows; else null. */
export function parseLocalAction(input: unknown, offered: readonly PageAction[]): LocalAction | null {
  if (typeof input !== 'string') return null;
  return offered.find((a) => a.id === input)?.id ?? null;
}

/** The address query a local page reads its model from. */
export function modelQuery(model: LaunchModel | AboutModel): Record<string, string> {
  return { model: JSON.stringify(model) };
}

/**
 * Where the launch view stands, from the app page's `data-specs` attribute: "ready" lifts the launch
 * view, "error" turns it into the error page, anything else (loading, or the page not drawn yet) waits.
 */
export function launchStep(specs: unknown): 'wait' | 'ready' | 'error' {
  return specs === 'ready' ? 'ready' : specs === 'error' ? 'error' : 'wait';
}

/** The spec API's error message from its JSON body, or the status when it has none. */
export function specErrorMessage(status: number, body: unknown): string {
  const error = body && typeof body === 'object' ? (body as { error?: unknown }).error : undefined;
  return typeof error === 'string' && error.trim() ? error.trim() : `GET /api/spec answered ${status}.`;
}
