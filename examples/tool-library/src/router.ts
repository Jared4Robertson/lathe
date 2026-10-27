// The HTTP API: maps routes to services and service errors to HTTP responses.
// Spec: the endpoint handlers TL-LEND-EP01-H to EP07-H (examples/tool-library/data/).
// Every error response is JSON: { "error": "<code>", "message": "<sentence>" }.
// Each route's statuses and bodies are its endpoint's API requirements (TL-LEND-EP0n-R0n).
// TL-PAT-LIBRARIAN-ACTION-R02: each librarian action answers with the record as the store saved it
// (the store returns rows with RETURNING *), so what the librarian sees is what is stored.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { LendingService } from './lending-service.ts';
import { MemberService } from './member-service.ts';
import { DEFAULT_TIME_ZONE, LendingError, type Clock, type LibrarySettings } from './model.ts';
import type { Store } from './store.ts';
import { ToolService } from './tool-service.ts';

type Handler = (params: number[], body: Record<string, unknown>) => { status: number; body: unknown };

interface Route {
  method: string;
  pattern: RegExp;
  handler: Handler;
}

// TL-LEND-EP06-H, TL-LEND-EP06-R03: a body over 64 KB is refused with 413 `body_too_large` before it is parsed,
// for every endpoint. A declared Content-Length over the limit is refused before any byte is read;
// a chunked or endless body is read only up to the limit, then reading stops and the connection closes.
export const MAX_BODY_BYTES = 64 * 1024;
/** How long a refused connection stays open after its 413 is written, so the client can read it before the socket closes. */
const CLOSE_GRACE_MS = 1000;

function bodyTooLarge(): LendingError {
  return new LendingError(413, 'body_too_large', `The request body is over ${MAX_BODY_BYTES / 1024} KB.`);
}

/** Reads the raw body, stopping (and pausing the request) as soon as it passes MAX_BODY_BYTES. */
function readBody(req: IncomingMessage): Promise<Buffer> {
  const declared = Number(req.headers['content-length']);
  if (declared > MAX_BODY_BYTES) return Promise.reject(bodyTooLarge());
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const stop = () => {
      req.off('data', onData);
      req.off('end', onEnd);
      req.off('error', onError);
    };
    const onData = (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        stop();
        req.pause();
        reject(bodyTooLarge());
        return;
      }
      chunks.push(chunk);
    };
    const onEnd = () => {
      stop();
      resolve(Buffer.concat(chunks));
    };
    const onError = (err: Error) => {
      stop();
      reject(err);
    };
    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
  });
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const raw = await readBody(req);
  if (raw.length === 0) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString('utf8'));
  } catch {
    throw new LendingError(400, 'invalid_json', 'The request body is not valid JSON.');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new LendingError(400, 'invalid_json', 'The request body must be a JSON object.');
  }
  return parsed as Record<string, unknown>;
}

/**
 * Answers a refused body and closes the connection without reading the rest of the body.
 * The request stays paused, so the server reads nothing more and TCP flow control holds the
 * client back. The whole answer (with its length and `Connection: close`) is written at once,
 * and the response is ended, which makes Node close the socket, only after a short grace:
 * closing a socket with unread data resets it, and a client still sending would lose the answer.
 */
function sendAndClose(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    connection: 'close',
  });
  res.write(text);
  setTimeout(() => res.end(), CLOSE_GRACE_MS);
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

/**
 * Builds the request handler for a store. `now` is the clock, so tests can move time;
 * `settings.timeZone` is the library's time zone (default America/New_York).
 */
export function createRouter(
  store: Store,
  now: Clock = () => new Date(),
  settings: LibrarySettings = { timeZone: DEFAULT_TIME_ZONE },
) {
  const members = new MemberService(store, now);
  const tools = new ToolService(store, now);
  const lending = new LendingService(store, now, settings.timeZone);

  const routes: Route[] = [
    // TL-LEND-EP01-H: R01-R03
    { method: 'POST', pattern: /^\/members$/, handler: (_p, b) => ({ status: 201, body: members.register(b) }) },
    // TL-LEND-EP02-H: R01-R02
    { method: 'POST', pattern: /^\/tools$/, handler: (_p, b) => ({ status: 201, body: tools.add(b) }) },
    // TL-LEND-EP03-H: R01
    { method: 'GET', pattern: /^\/tools$/, handler: () => ({ status: 200, body: tools.list() }) },
    // TL-LEND-EP04-H: R01-R05
    { method: 'POST', pattern: /^\/loans$/, handler: (_p, b) => ({ status: 201, body: lending.borrow(b) }) },
    // TL-LEND-EP05-H: R01-R03
    {
      method: 'POST',
      pattern: /^\/loans\/(\d+)\/return$/,
      handler: ([loanId], b) => ({ status: 200, body: lending.return(loanId, b) }),
    },
    // TL-LEND-EP06-H: R01-R03
    {
      method: 'POST',
      pattern: /^\/tools\/(\d+)\/damage$/,
      handler: ([toolId], b) => ({ status: 200, body: tools.reportDamage(toolId, b.note) }),
    },
    // TL-LEND-EP07-H: R01-R02
    {
      method: 'POST',
      pattern: /^\/tools\/(\d+)\/repair$/,
      handler: ([toolId]) => ({ status: 200, body: tools.markRepaired(toolId) }),
    },
  ];

  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const path = new URL(req.url ?? '/', 'http://localhost').pathname;
      const matching = routes.filter((r) => r.pattern.test(path));
      if (matching.length === 0) throw new LendingError(404, 'not_found', `There is no route ${path}.`);
      const route = matching.find((r) => r.method === req.method);
      if (!route) throw new LendingError(405, 'method_not_allowed', `${req.method} is not allowed on ${path}.`);
      const params = (path.match(route.pattern) ?? []).slice(1).map(Number);
      const body = req.method === 'GET' ? {} : await readJson(req);
      const result = route.handler(params, body);
      send(res, result.status, result.body);
    } catch (err) {
      if (err instanceof LendingError && err.code === 'body_too_large') {
        sendAndClose(res, err.status, { error: err.code, message: err.message });
      } else if (err instanceof LendingError) {
        send(res, err.status, { error: err.code, message: err.message });
      } else {
        console.error(err);
        send(res, 500, { error: 'internal', message: 'Something went wrong.' });
      }
    }
  };
}
