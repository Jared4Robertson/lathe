import { useEffect, useState } from 'react';
import type { ReadRefusal, StoreProblem } from '../../../lathe/src/server/contract';

// An aggregate page's read: one of its aggregate's queries, GET /api/<aggregate>/<query>?<field>=<value>
// (lathe/src/server/api.ts), whose answer is that query's own typed answer, such as a use case whole. The page reads it
// again whenever the data is read again (a write went through, or the files changed), keeping what it last read on
// screen meanwhile, so a page never blinks to a placeholder while its record is read afresh. What a route last answered
// is kept for the session, so a page drawn again (the wiki card's summary and its whole page) shows it at once.

export type Read<R> =
  | { state: 'reading' }
  | { state: 'read'; answer: R }
  | { state: 'refused'; error: string; problems: StoreProblem[] };

/** Each address's last answer, with the data it was read for. */
const known = new Map<string, { version: unknown; read: Read<unknown> }>();

/** A query's address: its route and its input as the query string, such as /api/use-case/get-use-case?id=TL-LEND-UC01. */
const addressOf = (route: string, input: Record<string, string>) => `${route}?${new URLSearchParams(input).toString()}`;

/** Reads the query once; a refusal or a server that does not answer is a refused read, with its reasons. */
async function readQuery<R>(address: string): Promise<Read<R>> {
  try {
    const res = await fetch(address, { headers: { accept: 'application/json' } });
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
 * one comes after every reload). Until the first answer it is reading.
 */
export function useRead<R>(route: string, input: Record<string, string>, version: unknown): Read<R> {
  const address = addressOf(route, input);
  const [read, setRead] = useState<Read<R>>(() => (known.get(address)?.read as Read<R> | undefined) ?? { state: 'reading' });
  useEffect(() => {
    const cached = known.get(address);
    if (cached) setRead(cached.read as Read<R>);
    else setRead({ state: 'reading' });
    if (cached?.version === version) return;
    let live = true;
    void readQuery<R>(address).then((answer) => {
      known.set(address, { version, read: answer });
      if (live) setRead(answer);
    });
    return () => { live = false; };
  }, [address, version]);
  return read;
}

/** Forgets every answer (for tests, between apps). */
export function forgetReads() {
  known.clear();
}
