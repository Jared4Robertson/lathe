import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { expect, vi } from 'vitest';
import App from '../src/App';
import type { SpecData, WriteAnswer } from '../../lathe/src/server/contract';
import type { BaselineAnswer } from '../../lathe/src/server/contract';
import type { Command } from '../../lathe/src/platform/data/generic-write';
import { workspace as fixtureWorkspace } from './fixtures/workspace';
import { SETTINGS_KEY } from '../src/graph/settings';
import { ALL_COMMANDS, ALL_QUERIES } from '../../lathe/src/commands';
import { InputError } from '../../lathe/src/platform/commands/definition';
import { StoreError } from '../../lathe/src/platform/data/problems';
import type { ReadView } from '../../lathe/src/platform/data/rules';
import { forgetReads } from '../src/record/read';

/** The served data as the aggregates' queries read it: each table's rows over every product folder, and each record by its ID. */
export function readViewOf(data: SpecData): ReadView {
  const rows = (table: string) => data.sources.flatMap((source) => source.tables[table] ?? []);
  let byId: Map<string, { kind: string; row: Row }> | null = null;
  return {
    schema: data.schema,
    rows,
    record: (id) => {
      byId ??= new Map(Object.keys(data.schema.kinds).flatMap((kind) => rows(kind).map((row) => [String(row.id), { kind, row }] as const)));
      return byId.get(id);
    },
  };
}

type Row = import('../../lathe/src/server/contract').Row;

/** One aggregate command the page sent: its route and its input. */
export interface SentCommand {
  route: string;
  input: Record<string, unknown>;
}

export interface Served {
  /** What GET /api/spec answers: the component-test workspace by default. */
  data?: SpecData;
  /**
   * What POST /api/write answers for a write's commands; by default every write goes through and
   * changes nothing. A function that returns new data serves it from then on.
   */
  write?: (commands: Command[]) => { answer: WriteAnswer; data?: SpecData };
  /** What GET /api/baseline answers, by its query's `since` (commit, branch or a hash); by default a 404. */
  baseline?: (since: string) => BaselineAnswer;
  /**
   * What an aggregate command (POST /api/<aggregate>/<command>) answers for its route and input; by default every one
   * goes through and changes nothing. A function that returns new data serves it from then on.
   */
  command?: (sent: SentCommand) => { answer: WriteAnswer; data?: SpecData };
}

/** Every request the page made, as "METHOD /path". */
export type Requests = string[];

/** The writes the page sent, each its commands. */
export type Writes = Command[][];

/** Stubs fetch with the given data, and records every request and write. */
export function serve(served: Served = {}): { requests: Requests; writes: Writes; commands: SentCommand[] } {
  const requests: Requests = [];
  const writes: Writes = [];
  const commands: SentCommand[] = [];
  forgetReads();
  let data = served.data ?? fixtureWorkspace();
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
    requests.push(`${init?.method ?? 'GET'} ${url}`);
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (url === '/api/spec') return json(data);
    if (url.startsWith('/api/baseline') && served.baseline) return json(served.baseline(new URLSearchParams(url.split('?')[1]).get('since') ?? ''));
    if (url === '/api/write' && init?.method === 'POST') {
      const { commands } = JSON.parse(String(init.body)) as { commands: Command[] };
      writes.push(commands);
      const result = served.write?.(commands) ?? { answer: { ok: true, tables: [], files: [], changes: [] } };
      if (result.data) data = result.data;
      return json(result.answer, result.answer.ok ? 200 : 422);
    }
    // An aggregate's query, read by the query itself over the served data, as the server reads it.
    const [route, query = ''] = url.split('?');
    const read = ALL_QUERIES.find((q) => q.route === route);
    if (read && (init?.method ?? 'GET') === read.method) {
      try {
        return json(read.run(readViewOf(data), Object.fromEntries(new URLSearchParams(query)) as never));
      } catch (error) {
        if (error instanceof StoreError) return json({ error: error.message, problems: error.problems }, 422);
        if (error instanceof InputError) return json({ error: error.message }, 400);
        throw error;
      }
    }
    const command = ALL_COMMANDS.find((c) => c.route === route);
    if (command && init?.method === 'POST') {
      const sent = { route, input: JSON.parse(String(init.body)) as Record<string, unknown> };
      commands.push(sent);
      const result = served.command?.(sent) ?? { answer: { ok: true, tables: [], files: [], changes: [] } };
      if (result.data) data = result.data;
      return json(result.answer, result.answer.ok ? 200 : 422);
    }
    return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
  }));
  return { requests, writes, commands };
}

/** Opens the app at an address with the given data, and waits for the specs to load. */
export async function openApp(path: string, served: Served = {}) {
  cleanup();
  window.history.replaceState(null, '', path);
  const { requests, writes, commands } = serve(served);
  const view = render(<App />);
  // The data has loaded (or failed to) once the shell says so.
  await waitFor(() => expect(document.querySelector('.app[data-specs]')?.getAttribute('data-specs')).not.toBe('loading'));
  return { ...view, requests, writes, commands };
}

export const main = () => screen.getByRole('main');

/** The Checks panel over the stage (`?panel=checks`). */
export const checksPanel = () => screen.getByRole('region', { name: 'Checks' });

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

/** Starts the place at a depth and the window at a layout, as if the person had chosen them (the default is 1, Tree). */
export function startAtDepth(depth: number, layout: 'tree' | 'nested' = 'tree') {
  window.sessionStorage.setItem(SETTINGS_KEY, JSON.stringify({ layout, minimap: false, cardWidth: null, chat: false, chatWidth: null, lens: false, since: 'commit', follow: false, looked: {} }));
  window.sessionStorage.setItem('lathe:place', JSON.stringify({ depth, hiddenKinds: [], card: { open: true, expanded: true } }));
}

/** A record's facts (kind, fields, data file, links out and in), after its body in the wiki card's whole page. */
export const facts = () => within(screen.getByRole('region', { name: 'Wiki card' })).getByRole('complementary', { name: 'Facts' });

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
