import type { ReadRefusal } from '../../../lathe/src/server/contract';
import type { Read } from './read';

/**
 * Reads a query's answer once (GET /api/<aggregate>/<query>?<input>): a refusal or a server that does not answer is a
 * refused read, with its reasons. `heard`, given each response, notes what the server says of this device (the page's
 * reads note its access, edit/access.ts); a worker's reads have no page to tell.
 */
export async function readAnswer<R>(address: string, heard?: (res: Response) => void): Promise<Exclude<Read<R>, { state: 'reading' }>> {
  try {
    const res = await fetch(address, { headers: { accept: 'application/json' } });
    heard?.(res);
    const body: unknown = await res.json().catch(() => null);
    if (res.ok) return { state: 'read', answer: body as R };
    const refusal = (body ?? {}) as Partial<ReadRefusal>;
    return { state: 'refused', error: refusal.error ?? `The server answered ${res.status}.`, problems: refusal.problems ?? [] };
  } catch (error) {
    return { state: 'refused', error: `The server did not answer: ${error instanceof Error ? error.message : String(error)}`, problems: [] };
  }
}
