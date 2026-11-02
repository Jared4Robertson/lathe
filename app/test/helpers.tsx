import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { expect, vi } from 'vitest';
import App from '../src/App';
import type { WriteAnswer } from '../../lathe/src/server/contract';
import type { BaselineAnswer } from '../../lathe/src/server/contract';
import { workspace as fixtureWorkspace } from './fixtures/workspace';
import { desktopStandIn } from './desktop-bridge';
import { SESSION_SETTINGS_STORAGE } from '../src/exploring/session-settings/model';
import { ALL_COMMANDS, ALL_QUERIES } from '../../lathe/src/commands';
import { InputError } from '../../lathe/src/platform/commands/definition';
import { answerQuery } from '../../lathe/src/platform/commands/run';
import { StoreError } from '../../lathe/src/platform/data/problems';
import { forgetReads } from '../src/record/read';
import { readViewOf, type ServedData } from './read-view';
import { referenceOf } from '../../lathe/src/reference';
import { LIST_RECORD_CHANGES } from '../../lathe/src/exploring/record-changes/queries';
import type { LatheDesktop } from '../src/shell/desktop-bridge';
import { ACCESS_HEADER, READ_ONLY } from '../../lathe/src/server/access';

/** One aggregate command the page sent: its route and its input. */
export interface SentCommand {
  route: string;
  input: Record<string, unknown>;
}

export interface Served {
  /** The data every query reads: the component-test workspace by default. */
  data?: ServedData;
  /** The baseline the Record changes read is given, by its `since` (commit, branch or a hash); by default none. */
  baseline?: (since: string) => BaselineAnswer;
  /**
   * What an aggregate command (POST /api/<aggregate>/<command>) answers for its route and input; by default every one
   * goes through and changes nothing. A function that returns new data serves it from then on.
   */
  command?: (sent: SentCommand) => { answer: WriteAnswer; data?: ServedData };
  /** True to answer as a server answers another device on the network: every answer marked read-only. */
  readOnly?: boolean;
}

/** Every request the page made, as "METHOD /path". */
export type Requests = string[];

/** Stubs fetch with the given data, and records every request and command. */
export function serve(served: Served = {}): { requests: Requests; commands: SentCommand[] } {
  const requests: Requests = [];
  const commands: SentCommand[] = [];
  forgetReads();
  let data = served.data ?? fixtureWorkspace();
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
    requests.push(`${init?.method ?? 'GET'} ${url}`);
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...(served.readOnly ? { [ACCESS_HEADER]: READ_ONLY } : {}) } });
    // The Reference read: the schema's kinds, tables and relations, with the check rows.
    if (url === '/api/reference') {
      const { schema } = data;
      const order = Object.keys(schema.kinds).sort((a, b) => (schema.kinds[a].position ?? Infinity) - (schema.kinds[b].position ?? Infinity) || a.localeCompare(b));
      return json(referenceOf(schema, order, data.sources.flatMap((source) => source.tables.check ?? [])));
    }
    // An aggregate's query, read by the query itself over the served data, as the server reads it.
    const [route, query = ''] = url.split('?');
    const read = ALL_QUERIES.find((q) => q.route === route);
    if (read && (init?.method ?? 'GET') === read.method) {
      try {
        const input = Object.fromEntries(new URLSearchParams(query));
        // The Record changes read is given the baseline its `since` names, as the server reads it from git.
        const baseline = read.route === LIST_RECORD_CHANGES.route ? served.baseline?.(input.since ?? '') : undefined;
        return json(answerQuery({ ...readViewOf(data), ...(baseline ? { baseline } : {}) }, read, input));
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
  return { requests, commands };
}

/** Opens the app at an address with the given data, and waits for the specs to load. */
export async function openApp(path: string, served: Served = {}) {
  cleanup();
  window.history.replaceState(null, '', path);
  const { requests, commands } = serve(served);
  const view = render(<App />);
  // The data has loaded (or failed to) once the shell says so.
  await waitFor(() => expect(document.querySelector('.app[data-specs]')?.getAttribute('data-specs')).not.toBe('loading'));
  return { ...view, requests, commands };
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

/** A section of the page once its heading has drawn: for a section filled by a read that answers after the page's own. */
export async function findSection(name: string | RegExp) {
  await within(main()).findByRole('heading', { name });
  return section(name);
}

/** Starts the place at a depth and the window at a layout, as if the person had chosen them (the default is 1, Tree). */
export function startAtDepth(depth: number, layout: 'tree' | 'nested' | 'map' = 'tree') {
  window.sessionStorage.setItem(SESSION_SETTINGS_STORAGE.key, JSON.stringify({ layout, minimap: false, allLinks: false, cardWidth: null, chat: false, chatWidth: null, highlight: false, since: 'commit', follow: false, looked: {} }));
  window.sessionStorage.setItem('lathe:place', JSON.stringify({ depth, hiddenKinds: [], card: { open: true, expanded: true } }));
}

/** A record's facts (kind, fields, data file, links out and in), after its body in the wiki card's whole page. */
export const facts = () => within(screen.getByRole('region', { name: 'Wiki card' })).getByRole('complementary', { name: 'Facts' });

/** The desktop shell's bridge with every member a no-op (test/desktop-bridge.ts), for a test to override what it watches. */
export const desktopBridgeStub = (over: Partial<LatheDesktop> = {}): LatheDesktop => ({ ...desktopStandIn(), ...over });
