// The window's own pages (LA-V68-R01, LA-V69-R01): a calm launch view over the window from the moment it
// opens until the page has the product's specs, and an error page when Lathe cannot load the folder.
// Both are static/launch.html, drawn over the app's page in a view of their own and given a model as
// JSON in the address; the About window is static/about.html the same way. The error page's buttons reach the
// main process through local-preload.cts, each on its command's own channel, and parseLocalAction checks each
// before it runs; About's links open in the system browser only when About shows them (aboutLink). Pure, so
// test/launch.test.ts covers it.
import type { Chrome } from './chrome.ts';
import { displayPath } from './folders.ts';

export type LocalAction = 'retry' | 'open-another' | 'reveal';

/** The channel each button sends on (local-preload.cts): one per command it runs. */
export const LOCAL_ACTION_CHANNELS: Record<LocalAction, string> = {
  retry: 'lathe:retry-app-server',
  'open-another': 'lathe:open-product-folder',
  reveal: 'lathe:reveal-product-folder',
};

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

/** A link of the About window's, which opens in the system browser. */
export interface PageLink {
  label: string;
  url: string;
}

export interface AboutModel {
  name: string;
  versions: { label: string; value: string }[];
  links: PageLink[];
  colors: Chrome;
}

/**
 * The About window: the app, engine and Electron versions, the Lathe the product in front opened with (its own
 * installed Lathe or the bundled one), and links to the repo and the data reference.
 */
export function aboutModel(versions: { app: string; engine: string | null; electron: string; chrome: string; node: string }, colors: Chrome, product: { lathe: string } | null = null): AboutModel {
  return {
    name: 'Lathe',
    versions: [
      { label: 'Version', value: versions.app },
      { label: 'Engine', value: versions.engine ?? 'unknown' },
      ...(product ? [{ label: 'Opened with', value: product.lathe }] : []),
      { label: 'Electron', value: versions.electron },
      { label: 'Chromium', value: versions.chrome },
      { label: 'Node.js', value: versions.node },
    ],
    links: [
      { label: 'Source Code', url: REPO_URL },
      { label: 'Data Reference', url: REFERENCE_URL },
    ],
    colors,
  };
}

/** The repo, and its data reference (every table, column, relation and check), which the About window links to. */
export const REPO_URL = 'https://github.com/Jared4Robertson/lathe';
export const REFERENCE_URL = `${REPO_URL}/blob/main/lathe/REFERENCE.md`;

/** A button press from a local page, when it is one of the actions that page shows; else null. */
export function parseLocalAction(input: unknown, offered: readonly PageAction[]): LocalAction | null {
  if (typeof input !== 'string') return null;
  return offered.find((a) => a.id === input)?.id ?? null;
}

/** A link the About window opens, when it is one of the links it shows; else null. */
export function aboutLink(url: string, model: AboutModel): string | null {
  return model.links.find((l) => l.url === url)?.url ?? null;
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
