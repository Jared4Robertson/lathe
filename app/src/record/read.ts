import { useEffect, useRef, useState } from 'react';
import type { ReadRefusal, StoreProblem } from '../../../lathe/src/server/contract';
import { noteAccess } from '../edit/access';

// An aggregate page's read: one of its aggregate's queries, GET /api/<aggregate>/<query>?<field>=<value>
// (lathe/src/server/api.ts), whose answer is that query's own typed answer, such as a use case whole. The page reads it
// again when the data changes in a way its read model sees (a write went through, or the files changed), keeping what
// it last read on screen meanwhile, so a page never blinks to a placeholder while its record is read afresh. What a route last answered
// is kept for the session, so a page drawn again (the wiki card's summary and its whole page) shows it at once.

export type Read<R> =
  | { state: 'reading' }
  | { state: 'read'; answer: R }
  | { state: 'refused'; error: string; problems: StoreProblem[] };

/** A read with the data version it answers for, and its read model's changes when it was read: what useRead keeps for each address. */
type Kept = { version: unknown; changes: string; read: Read<unknown> };

/** Each address's last answer, with the data it was read for. */
const known = new Map<string, Kept>();

// How many times each read model changed, by its slice's name (the `<slice>` of /api/<slice>/<query>), and how many
// times every read model did at once. A read is read again for a new version of the data only when its own read model
// changed since it was read (LA-PLT-UC03-R02): the server names the read models each change touches.
const changed = { all: 0, by: new Map<string, number>() };
const readModelOf = (route: string) => route.split('/')[2] ?? '';
/** How many times the read model of a query's route has changed: a read stamped with it stands until it moves. */
export const readModelChanges = (route: string): string => `${changed.all}:${changed.by.get(readModelOf(route)) ?? 0}`;

/** Marks the read models a change names (every one, for null) as changed: their reads read again for the next version. */
export function readModelsChanged(readModels: readonly string[] | null): void {
  if (readModels === null) changed.all++;
  else for (const name of readModels) changed.by.set(name, (changed.by.get(name) ?? 0) + 1);
}

/** A query's address: its route and its input as the query string, such as /api/use-case/get-use-case?id=TL-LEND-UC01. */
const queryAddress = (route: string, input: Record<string, string>) => { const query = new URLSearchParams(input).toString(); return query ? `${route}?${query}` : route; };

/** Reads the query once; a refusal or a server that does not answer is a refused read, with its reasons. */
async function readQuery<R>(address: string): Promise<Read<R>> {
  try {
    const res = await fetch(address, { headers: { accept: 'application/json' } });
    noteAccess(res);
    const body: unknown = await res.json().catch(() => null);
    if (res.ok) return { state: 'read', answer: body as R };
    const refusal = (body ?? {}) as Partial<ReadRefusal>;
    return { state: 'refused', error: refusal.error ?? `The server answered ${res.status}.`, problems: refusal.problems ?? [] };
  } catch (error) {
    return { state: 'refused', error: `The server did not answer: ${error instanceof Error ? error.message : String(error)}`, problems: [] };
  }
}

/**
 * The query's answer for the input, read again when `version` changes (pass the data the page is drawn from: a new
 * one comes after every reload). Until the first answer it is reading. With no input (null) nothing is read.
 */
export function useRead<R>(route: string, input: Record<string, string> | null, version: unknown): Read<R> {
  return useVersionedRead<R>(route, input, version).read;
}

/** useRead, with the version the read on screen answers for (undefined while nothing is read). */
export function useVersionedRead<R>(route: string, input: Record<string, string> | null, version: unknown): { read: Read<R>; version: unknown } {
  const address = input ? queryAddress(route, input) : '';
  const [kept, setKept] = useState<Kept>(() => known.get(address) ?? { version: undefined, changes: '', read: { state: 'reading' } });
  // The address last read: the same address read again keeps its answer on screen even when nothing is kept for it.
  const last = useRef(address);
  useEffect(() => {
    if (!address) { setKept({ version: undefined, changes: '', read: { state: 'reading' } }); return; }
    const cached = known.get(address);
    if (cached) setKept(cached);
    else if (last.current !== address) setKept({ version: undefined, changes: '', read: { state: 'reading' } });
    last.current = address;
    if (cached?.version === version) return;
    const changes = readModelChanges(route);
    // Its read model has not changed since it was read: the answer (or refusal) stands for this version too.
    if (cached && cached.changes === changes) {
      const next = { ...cached, version };
      known.set(address, next);
      setKept(next);
      return;
    }
    let live = true;
    void readQuery<R>(address).then((answer) => {
      const next = { version, changes, read: answer };
      known.set(address, next);
      if (live) setKept(next);
    });
    return () => { live = false; };
  }, [address, route, version]);
  return { read: kept.read as Read<R>, version: kept.version };
}

/** Forgets every answer (for tests, between apps). */
export function forgetReads() {
  known.clear();
  // Every read model counts as changed, so no answer kept elsewhere for the old data stands either.
  changed.all++;
}
