import { createContext, useContext } from 'react';
import type { WriteAnswer } from '../../../lathe/src/server/contract';
import type { Command } from '../../../lathe/src/platform/data/generic-write';

// Writes through the server: one aggregate command, POST /api/<aggregate>/<command> with its input, as an aggregate's
// editor sends it; or, for a kind whose aggregate has no editor yet, POST /api/write with the commands of one write.
// The answer is the changed rows, or the refusal with every reason; either way nothing is half written. The shell
// provides `command` and `write`, which reload the data after a write that went through.

/** Sends one aggregate command: its route, such as /api/use-case/add-flow-step, and its input. */
export const postCommand = (route: string, input: object): Promise<WriteAnswer> => post(route, input);

export const postWrite = (commands: Command[]): Promise<WriteAnswer> => post('/api/write', { commands });

async function post(route: string, payload: object): Promise<WriteAnswer> {
  let res: Response;
  try {
    res = await fetch(route, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(payload) });
  } catch (error) {
    return { ok: false, error: `The server did not answer: ${error instanceof Error ? error.message : String(error)}`, problems: [] };
  }
  const body = await res.json().catch(() => null);
  if (body && typeof body === 'object' && 'ok' in body) return body as WriteAnswer;
  return { ok: false, error: body?.error ?? `The server answered ${res.status}.`, problems: [] };
}

export interface Writer {
  /** Runs one aggregate command, then reloads the data when it went through. */
  command: (route: string, input: object) => Promise<WriteAnswer>;
  /** Writes the commands as one transaction, then reloads the data when it went through. */
  write: (commands: Command[]) => Promise<WriteAnswer>;
}

const WriterContext = createContext<Writer | null>(null);
export const WriterProvider = WriterContext.Provider;
/** The shell's writer, or null where records are only read (a record shown outside the shell). */
export const useWriter = () => useContext(WriterContext);
