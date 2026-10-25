import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { expect, vi } from 'vitest';
import App from '../src/App';
import type { DiagramSummary } from '../src/types';
import type { Workspace } from '../../lathe/src/types';
import type { FormatReference } from '../src/format/reference';
import { formatReference } from './fixtures/format';
import { workspace as fixtureWorkspace } from './fixtures/workspace';

export interface Served {
  workspace?: Workspace;
  source?: 'engine' | 'fixture';
  reason?: string;
  diagrams?: DiagramSummary[];
  /** What GET /api/format answers: the fixture's reference by default, or null for no answer (as when the engine is not there). */
  format?: FormatReference | null;
}

/** Every request the page made, as "METHOD /path". */
export type Requests = string[];

/** Stubs fetch with the given workspace and diagrams, and records every request. */
export function serve(served: Served = {}): Requests {
  const requests: Requests = [];
  const ws = served.workspace ?? fixtureWorkspace();
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
    requests.push(`${init?.method ?? 'GET'} ${url}`);
    const json = (body: unknown, headers: Record<string, string> = {}) =>
      new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json', ...headers } });
    if (url === '/api/spec') {
      const headers: Record<string, string> = { 'x-lathe-source': served.source ?? 'engine' };
      if (served.reason) headers['x-lathe-source-reason'] = encodeURIComponent(served.reason);
      return json(ws, headers);
    }
    if (url === '/api/diagrams') return json(served.diagrams ?? []);
    if (url === '/api/format' && served.format !== null) return json(served.format ?? formatReference());
    return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
  }));
  return requests;
}

/** Opens the app at an address with the given data, and waits for the specs to load. */
export async function openApp(path: string, served: Served = {}) {
  cleanup();
  window.history.replaceState(null, '', path);
  const requests = serve(served);
  const view = render(<App />);
  // The specs have loaded (or failed to) once the shell says so.
  await waitFor(() => expect(document.querySelector('.app[data-specs]')?.getAttribute('data-specs')).not.toBe('loading'));
  return { ...view, requests };
}

export const main = () => screen.getByRole('main');

/** The page's section with this heading. */
export function section(name: string | RegExp) {
  const heading = within(main()).getByRole('heading', { name });
  const element = heading.closest('section');
  expect(element).not.toBeNull();
  return element as HTMLElement;
}

/** Starts the graph at a depth for the session, as if the person had chosen it (the default is 1). */
export function startAtDepth(depth: number) {
  window.sessionStorage.setItem('lathe:graph-settings', JSON.stringify({ depth, trace: false, hiddenKinds: [], hiddenRelations: [], links: false, minimap: false }));
}

/**
 * Opens the side bar in these view modes for the rest of the test, as if the person
 * had opened it there last (brief 64: it starts closed in the Wiki view, open in the Graph and Model views).
 */
export function openSideBar(view: 'details' | 'outline' | 'history' = 'details', modes: ('wiki' | 'graph' | 'model')[] = ['wiki']) {
  window.localStorage.setItem('lathe:side-bar', JSON.stringify(Object.fromEntries(modes.map((m) => [m, { open: true, view }]))));
}

/** The side bar, by its name. */
export const sideBar = () => screen.getByRole('complementary', { name: 'Side bar' });

/** The desktop shell's bridge with every member a no-op, for a test to override what it watches. */
export const desktopBridgeStub = (over: Partial<LatheDesktop> = {}): LatheDesktop => ({
  isDesktop: true,
  platform: 'darwin',
  onCommand: () => () => {},
  setChrome: () => {},
  onFullScreen: () => () => {},
  setErrorCount: () => {},
  revealRecord: () => {},
  openRecordInEditor: () => {},
  copyRecordId: () => {},
  showRecordMenu: () => {},
  ...over,
});
