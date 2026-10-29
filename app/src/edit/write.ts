import { createContext, useContext } from 'react';
import type { WriteAnswer } from '../../../lathe/src/server/contract';
import type { Command } from '../../../lathe/src/platform/data/generic-write';

// Writes through the server's command layer: POST /api/write with the commands of one write. The
// answer is the changed rows, or the store's refusal with every reason; either way nothing is
// half written. The shell provides `write`, which reloads the data after a write that went through.


export async function postWrite(commands: Command[]): Promise<WriteAnswer> {
  let res: Response;
  try {
    res = await fetch('/api/write', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ commands }) });
  } catch (error) {
    return { ok: false, error: `The server did not answer: ${error instanceof Error ? error.message : String(error)}`, problems: [] };
  }
  const body = await res.json().catch(() => null);
  if (body && typeof body === 'object' && 'ok' in body) return body as WriteAnswer;
  return { ok: false, error: body?.error ?? `The server answered ${res.status}.`, problems: [] };
}

export interface Writer {
  /** Writes the commands as one transaction, then reloads the data when it went through. */
  write: (commands: Command[]) => Promise<WriteAnswer>;
}

const WriterContext = createContext<Writer | null>(null);
export const WriterProvider = WriterContext.Provider;
/** The shell's writer, or null where records are only read (a record shown outside the shell). */
export const useWriter = () => useContext(WriterContext);
