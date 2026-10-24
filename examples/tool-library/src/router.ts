// The HTTP API: maps routes to services and service errors to HTTP responses.
// Spec: TL-LEND-C06 (specs/tool-library/lending/02-design/components/C06-router.md)
// Every error response is JSON: { "error": "<code>", "message": "<sentence>" }.
// Each route's statuses and bodies are its endpoint's interaction requirements (TL-LEND-E0n-R0n).
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

// TL-LEND-E06-R03: a body over 64 KB is refused with 413 before it is parsed (for every endpoint).
const MAX_BODY_BYTES = 64 * 1024;

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new LendingError(413, 'body_too_large', 'The request body is too large.');
    chunks.push(chunk as Buffer);
  }
  if (size === 0) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new LendingError(400, 'invalid_json', 'The request body is not valid JSON.');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new LendingError(400, 'invalid_json', 'The request body must be a JSON object.');
  }
  return parsed as Record<string, unknown>;
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
    // TL-LEND-E01: R01-R03
    { method: 'POST', pattern: /^\/members$/, handler: (_p, b) => ({ status: 201, body: members.register(b) }) },
    // TL-LEND-E02: R01-R02
    { method: 'POST', pattern: /^\/tools$/, handler: (_p, b) => ({ status: 201, body: tools.add(b) }) },
    // TL-LEND-E03: R01
    { method: 'GET', pattern: /^\/tools$/, handler: () => ({ status: 200, body: tools.list() }) },
    // TL-LEND-E04: R01-R05
    { method: 'POST', pattern: /^\/loans$/, handler: (_p, b) => ({ status: 201, body: lending.borrow(b) }) },
    // TL-LEND-E05: R01-R03
    {
      method: 'POST',
      pattern: /^\/loans\/(\d+)\/return$/,
      handler: ([loanId], b) => ({ status: 200, body: lending.return(loanId, b) }),
    },
    // TL-LEND-E06: R01-R03
    {
      method: 'POST',
      pattern: /^\/tools\/(\d+)\/damage$/,
      handler: ([toolId], b) => ({ status: 200, body: tools.reportDamage(toolId, b.note) }),
    },
    // TL-LEND-E07: R01-R02
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
      if (err instanceof LendingError) {
        send(res, err.status, { error: err.code, message: err.message });
      } else {
        console.error(err);
        send(res, 500, { error: 'internal', message: 'Something went wrong.' });
      }
    }
  };
}
