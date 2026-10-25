import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Coverage, Kind, Problem, SpecLink, SpecRecord, Workspace } from '../../../lathe/src/types';
import { onLatheEvent } from '../events';

export type { Coverage, Kind, Problem, SpecLink, SpecRecord, Workspace };

export interface SpecIndex {
  workspace: Workspace;
  byId: Map<string, SpecRecord>;
  kinds: Map<string, Kind>;
  children: Map<string, SpecRecord[]>;
  outgoing: Map<string, SpecLink[]>;
  incoming: Map<string, SpecLink[]>;
  problemsFor: Map<string, Problem[]>;
  coverage: Map<string, Coverage>;
  products: SpecRecord[];
  domainsOf: Map<string, SpecRecord[]>;
}

const push = <K, V>(map: Map<K, V[]>, key: K, value: V) => {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
};

export const byIdOrder = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id, 'en', { numeric: true });

export function indexWorkspace(workspace: Workspace): SpecIndex {
  const records = [...workspace.records].sort(byIdOrder);
  const byId = new Map(records.map((r) => [r.id, r]));
  const children = new Map<string, SpecRecord[]>();
  const outgoing = new Map<string, SpecLink[]>();
  const incoming = new Map<string, SpecLink[]>();
  const problemsFor = new Map<string, Problem[]>();
  const domainsOf = new Map<string, SpecRecord[]>();
  for (const r of records) {
    if (r.parent) push(children, r.parent, r);
    if (r.kind === 'domain' && r.product) push(domainsOf, r.product, r);
  }
  for (const l of workspace.links) {
    push(outgoing, l.source, l);
    push(incoming, l.target, l);
  }
  for (const p of workspace.problems) if (p.record) push(problemsFor, p.record, p);
  return {
    workspace,
    byId,
    kinds: new Map(workspace.kinds.map((k) => [k.kind, k])),
    children,
    outgoing,
    incoming,
    problemsFor,
    coverage: new Map(workspace.coverage.map((c) => [c.domain, c])),
    products: records.filter((r) => r.kind === 'product'),
    domainsOf,
  };
}

/** Errors before warnings, then by check name and record. */
export const problemOrder = (a: Problem, b: Problem) =>
  (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1) ||
  a.check.localeCompare(b.check) ||
  (a.record ?? '').localeCompare(b.record ?? '', 'en', { numeric: true });

export interface SpecState {
  index: SpecIndex | null;
  source: 'engine' | 'fixture' | null;
  sourceReason: string | null;
  error: string | null;
}

/** Fetches GET /api/spec once, and again whenever the server reports a spec change. */
export function useSpec(): SpecState {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [source, setSource] = useState<SpecState['source']>(null);
  const [sourceReason, setSourceReason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/spec');
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? response.statusText);
      setWorkspace(body);
      setSource(response.headers.get('x-lathe-source') === 'fixture' ? 'fixture' : 'engine');
      const reason = response.headers.get('x-lathe-source-reason');
      setSourceReason(reason ? decodeURIComponent(reason) : null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
    return onLatheEvent('spec:changed', load);
  }, [load]);

  const index = useMemo(() => (workspace ? indexWorkspace(workspace) : null), [workspace]);
  return { index, source, sourceReason, error };
}

export const productPath = (id: string) => `/specs/${encodeURIComponent(id)}`;
export const domainPath = (product: string, domain: string) => `/specs/${encodeURIComponent(product)}/${encodeURIComponent(domain)}`;
export const recordPath = (id: string) => `/records/${encodeURIComponent(id)}`;
/** A group's address: its parent record and the kind of its members, then the parts of a test-plan group within it ("test/acceptance"). */
export const groupPath = (parent: string, kind: string) => `/records/${encodeURIComponent(parent)}/${kind.split('/').map(encodeURIComponent).join('/')}`;
export const checksPath = '/checks';
export const formatPath = '/format';

export type SpecRoute =
  | { page: 'product'; product: string }
  | { page: 'domain'; product: string; domain: string }
  | { page: 'record'; id: string }
  | { page: 'group'; parent: string; kind: string }
  | { page: 'redirect'; to: string }
  | { page: 'checks' }
  | { page: 'format' }
  | { page: 'format-kind'; kind: string }
  | { page: 'format-check'; check: string }
  | { page: 'specs' }
  | { page: 'missing' };

/** Parses a spec path, or returns null for any other path (Diagrams). */
export function parseSpecRoute(pathname: string): SpecRoute | null {
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'checks') return parts.length === 1 ? { page: 'checks' } : { page: 'missing' };
  if (parts[0] === 'format') {
    if (parts.length === 1) return { page: 'format' };
    // A kind's page and a check's page in the format reference.
    if (parts.length === 3 && parts[1] === 'kinds') return { page: 'format-kind', kind: parts[2] };
    if (parts.length === 3 && parts[1] === 'checks') return { page: 'format-check', check: parts[2] };
    return { page: 'missing' };
  }
  if (parts[0] === 'records') {
    if (parts.length === 2) return { page: 'record', id: parts[1] };
    // A test-plan group in a Tests folder has more parts after the kind.
    if (parts.length >= 3) return { page: 'group', parent: parts[1], kind: parts.slice(2).join('/') };
    return { page: 'missing' };
  }
  if (parts[0] !== 'specs') return null;
  if (parts.length === 1) return { page: 'specs' };
  if (parts.length === 2) return { page: 'product', product: parts[1] };
  if (parts.length === 3) return { page: 'domain', product: parts[1], domain: parts[2] };
  // The old graph tab of a domain is now the domain page in the Graph view.
  if (parts.length === 4 && parts[3] === 'graph') return { page: 'redirect', to: `${domainPath(parts[1], parts[2])}?view=graph` };
  return { page: 'missing' };
}

export const kindLabel = (index: SpecIndex, kind: string) => index.kinds.get(kind)?.label ?? kind.replaceAll('_', ' ');
