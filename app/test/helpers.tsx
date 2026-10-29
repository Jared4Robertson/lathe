import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { expect, vi } from 'vitest';
import App from '../src/App';
import type { SpecData, WriteAnswer } from '../../lathe/src/server/contract';
import type { Command } from '../../lathe/src/store/store';
import { workspace as fixtureWorkspace } from './fixtures/workspace';
import { STAGE_NAMES, type StageName } from '../src/views/address';
import { SETTINGS_KEY } from '../src/graph/settings';

export interface Served {
  /** What GET /api/spec answers: the component-test workspace by default. */
  data?: SpecData;
  /**
   * What POST /api/write answers for a write's commands; by default every write goes through and
   * changes nothing. A function that returns new data serves it from then on.
   */
  write?: (commands: Command[]) => { answer: WriteAnswer; data?: SpecData };
}

/** Every request the page made, as "METHOD /path". */
export type Requests = string[];

/** The writes the page sent, each its commands. */
export type Writes = Command[][];

/** Stubs fetch with the given data, and records every request and write. */
export function serve(served: Served = {}): { requests: Requests; writes: Writes } {
  const requests: Requests = [];
  const writes: Writes = [];
  let data = served.data ?? fixtureWorkspace();
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
    requests.push(`${init?.method ?? 'GET'} ${url}`);
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (url === '/api/spec') return json(data);
    if (url === '/api/write' && init?.method === 'POST') {
      const { commands } = JSON.parse(String(init.body)) as { commands: Command[] };
      writes.push(commands);
      const result = served.write?.(commands) ?? { answer: { ok: true, tables: [], files: [], changes: [] } };
      if (result.data) data = result.data;
      return json(result.answer, result.answer.ok ? 200 : 422);
    }
    return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
  }));
  return { requests, writes };
}

/** Opens the app at an address with the given data, and waits for the specs to load. */
export async function openApp(path: string, served: Served = {}) {
  cleanup();
  window.history.replaceState(null, '', path);
  const { requests, writes } = serve(served);
  const view = render(<App />);
  // The data has loaded (or failed to) once the shell says so.
  await waitFor(() => expect(document.querySelector('.app[data-specs]')?.getAttribute('data-specs')).not.toBe('loading'));
  return { ...view, requests, writes };
}

export const main = () => screen.getByRole('main');

/** The page's section with this heading. */
/** A stage on a domain or product page, by its name in the schema ("use-cases"): its heading and what it lists. */
export function stageOf(stage: string, scope: HTMLElement = main()) {
  const element = scope.querySelector<HTMLElement>(`.stage-${stage}`);
  expect(element).not.toBeNull();
  return element!;
}

export function section(name: string | RegExp) {
  const heading = within(main()).getByRole('heading', { name });
  const element = heading.closest('section');
  expect(element).not.toBeNull();
  return element as HTMLElement;
}

/** Starts the graph at a depth for the session, as if the person had chosen it (the default is 1). */
export function startAtDepth(depth: number, layout: 'tree' | 'nested' | 'voronoi' = 'tree') {
  window.sessionStorage.setItem(SETTINGS_KEY, JSON.stringify({ layout, depth, hiddenKinds: [], minimap: false, card: true, cardWidth: null, cardExpanded: true, chat: false, chatWidth: null }));
}

/**
 * Opens the side bar on these stages for the rest of the test, as if the person
 * had opened it there last (it starts open on the graph and the ERD, closed on the trace).
 */
export function openSideBar(view: 'details' | 'outline' | 'history' = 'details', modes: readonly StageName[] = STAGE_NAMES) {
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
  chat: {
    sessions: async () => ({ claude: null, configured: false, current: null, sessions: [] }),
    open: async () => false,
    send: async () => false,
    answer: async () => false,
    stop: async () => false,
    onPatch: () => () => {},
  },
  onAppRequest: () => () => {},
  ...over,
});
