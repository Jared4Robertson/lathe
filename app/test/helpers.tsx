import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { expect, vi } from 'vitest';
import App from '../src/App';
import type { DiagramSummary } from '../src/types';
import type { Workspace } from '../../lathe/src/types';
import { workspace as fixtureWorkspace } from './fixtures/workspace';

export interface Served {
  workspace?: Workspace;
  source?: 'engine' | 'fixture';
  reason?: string;
  diagrams?: DiagramSummary[];
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
