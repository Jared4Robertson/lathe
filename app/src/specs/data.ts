import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Coverage, Kind, Problem, SpecLink, SpecRecord, Workspace } from '../../../lathe/src/types';

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
    import.meta.hot?.on('spec:changed', load);
    return () => import.meta.hot?.off('spec:changed', load);
  }, [load]);

  const index = useMemo(() => (workspace ? indexWorkspace(workspace) : null), [workspace]);
  return { index, source, sourceReason, error };
}

export const productPath = (id: string) => `/specs/${encodeURIComponent(id)}`;
export const domainPath = (product: string, domain: string) => `/specs/${encodeURIComponent(product)}/${encodeURIComponent(domain)}`;
export const recordPath = (id: string) => `/records/${encodeURIComponent(id)}`;
export const checksPath = '/checks';

export type SpecRoute =
  | { page: 'product'; product: string }
  | { page: 'domain'; product: string; domain: string; tab: 'list' | 'graph' }
  | { page: 'record'; id: string }
  | { page: 'checks' }
  | { page: 'specs' }
  | { page: 'missing' };

/** Parses a spec path, or returns null for any other path (Diagrams). */
export function parseSpecRoute(pathname: string): SpecRoute | null {
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'checks') return parts.length === 1 ? { page: 'checks' } : { page: 'missing' };
  if (parts[0] === 'records') return parts.length === 2 ? { page: 'record', id: parts[1] } : { page: 'missing' };
  if (parts[0] !== 'specs') return null;
  if (parts.length === 1) return { page: 'specs' };
  if (parts.length === 2) return { page: 'product', product: parts[1] };
  if (parts.length === 3) return { page: 'domain', product: parts[1], domain: parts[2], tab: 'list' };
  if (parts.length === 4 && parts[3] === 'graph') return { page: 'domain', product: parts[1], domain: parts[2], tab: 'graph' };
  return { page: 'missing' };
}

export const kindLabel = (index: SpecIndex, kind: string) => index.kinds.get(kind)?.label ?? kind.replaceAll('_', ' ');
export const relationLabel = (relation: string) => relation.replaceAll('_', ' ');
