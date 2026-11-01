// The HTTP API: one endpoint handler per endpoint, each calling its command or query handler, and the
// errors they raise turned into HTTP responses.
// Spec: the endpoint handlers TL-LEND-EP01-H to EP10-H (examples/tool-library/data/).
// Every error response is JSON: { "error": "<code>", "message": "<sentence>" }.
// Each route's statuses and bodies are its endpoint's API requirements (TL-LEND-EP0n-R0n).
// TL-PAT-LIBRARIAN-ACTION-R02: each librarian action answers with the record as its repository saved it
// (the repositories return rows with RETURNING *), so what the librarian sees is what is stored.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ActiveLoansReader, findLoan } from './active-loans.ts';
import { CatalogReader, catalogEntry, listCatalog } from './catalog.ts';
import type { Database } from './database.ts';
import { subscribePolicies } from './event-handlers.ts';
import { Outbox, type HandlerFailure } from './events.ts';
import type { Loan } from './loan.ts';
import { borrowTool, renewLoan, returnTool, type LoanCommandContext } from './loan-commands.ts';
import { LoanRepository } from './loan-repository.ts';
import { registerMember } from './member-commands.ts';
import { MemberRepository } from './member-repository.ts';
import { DEFAULT_TIME_ZONE, LendingError, assertTimeZone, type Clock, type LibrarySettings } from './model.ts';
import { addTool, markToolRepaired, reportDamage } from './tool-commands.ts';
import { ToolRepository } from './tool-repository.ts';
import { ToolsWaitingForRepairReader, listToolsWaitingForRepair } from './waiting-for-repair.ts';

/** The Lending domain over one database: each aggregate's repository, the outbox, the clock and the time zone. */
export type Lending = LoanCommandContext;

/**
 * Opens the Lending domain over `db`: one repository per aggregate and one outbox. `now` is the clock, so tests can
 * move time; `timeZone` is the library's, refused unless known. No event handler is subscribed yet.
 */
export function openLending(db: Database, now: Clock, timeZone: string, onFailure?: HandlerFailure): Lending {
  return {
    db,
    members: new MemberRepository(db),
    tools: new ToolRepository(db),
    loans: new LoanRepository(db),
    outbox: new Outbox(db, now, onFailure),
    now,
    timeZone: assertTimeZone(timeZone),
  };
}

interface Reply {
  status: number;
  body: unknown;
}

type EndpointHandler = (lending: Lending, params: number[], body: Record<string, unknown>) => Reply;

interface Route {
  method: string;
  route: RegExp;
  handler: EndpointHandler;
}

// TL-LEND-EP06-R03: a body over 64 KB is refused with 413 `body_too_large` before it is parsed,
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

/** A loan as the API answers with it: the loan and its return, flattened. */
function loanBody(loan: Loan) {
  return {
    id: loan.id,
    memberId: loan.memberId,
    toolId: loan.toolId,
    borrowedAt: loan.borrowedAt,
    dueDate: loan.dueDate,
    returnedAt: loan.return?.returnedAt ?? null,
    returnCondition: loan.return?.condition ?? null,
    returnNote: loan.return?.note ?? null,
  };
}

/** TL-LEND-EP01-H: POST /members registers a member and answers 201 with it (R01-R03). */
function postMembers(lending: Lending, _params: number[], body: Record<string, unknown>): Reply {
  return { status: 201, body: registerMember(lending, body) };
}

/** TL-LEND-EP02-H: POST /tools adds a tool and answers 201 with its catalog entry (R01-R02). */
function postTools(lending: Lending, _params: number[], body: Record<string, unknown>): Reply {
  return { status: 201, body: catalogEntry(lending.loans, addTool(lending, body)) };
}

/** TL-LEND-EP03-H: GET /tools answers 200 with the catalog (R01). */
function getTools(lending: Lending): Reply {
  return { status: 200, body: listCatalog(new CatalogReader(lending)) };
}

/** TL-LEND-EP04-H: POST /loans borrows a tool and answers 201 with the loan (R01-R05). */
function postLoans(lending: Lending, _params: number[], body: Record<string, unknown>): Reply {
  return { status: 201, body: loanBody(borrowTool(lending, body)) };
}

/** TL-LEND-EP05-H: POST /loans/{loanId}/return returns a tool and answers 200 with the loan and whether it was late (R01-R03). */
function postLoanReturn(lending: Lending, [loanId]: number[], body: Record<string, unknown>): Reply {
  const { loan, late } = returnTool(lending, loanId, body);
  return { status: 200, body: { ...loanBody(loan), late } };
}

/** TL-LEND-EP06-H: POST /tools/{toolId}/damage reports damage and answers 200 with the catalog entry (R01-R04). */
function postToolDamage(lending: Lending, [toolId]: number[], body: Record<string, unknown>): Reply {
  return { status: 200, body: catalogEntry(lending.loans, reportDamage(lending, toolId, body.note)) };
}

/** TL-LEND-EP07-H: POST /tools/{toolId}/repair marks a tool repaired and answers 200 with the catalog entry (R01-R02). */
function postToolRepair(lending: Lending, [toolId]: number[]): Reply {
  return { status: 200, body: catalogEntry(lending.loans, markToolRepaired(lending, toolId)) };
}

/** TL-LEND-EP08-H: GET /tools/{toolId}/loan answers 200 with the tool's active loan (R01-R02). */
function getToolLoan(lending: Lending, [toolId]: number[]): Reply {
  return { status: 200, body: findLoan(new ActiveLoansReader(lending), toolId) };
}

/** TL-LEND-EP09-H: GET /tools/waiting-for-repair answers 200 with the tools waiting for repair, oldest damage first (R01). */
function getToolsWaitingForRepair(lending: Lending): Reply {
  return { status: 200, body: listToolsWaitingForRepair(new ToolsWaitingForRepairReader(lending)) };
}

/** TL-LEND-EP10-H: POST /loans/{loanId}/renew renews a loan and answers 200 with it and its new due date (R01-R03). */
function postLoanRenew(lending: Lending, [loanId]: number[]): Reply {
  return { status: 200, body: loanBody(renewLoan(lending, loanId)) };
}

/** Each endpoint's method and route, and its handler. */
const ROUTES: Route[] = [
  { method: 'POST', route: /^\/members$/, handler: postMembers },
  { method: 'POST', route: /^\/tools$/, handler: postTools },
  { method: 'GET', route: /^\/tools$/, handler: getTools },
  { method: 'POST', route: /^\/loans$/, handler: postLoans },
  { method: 'POST', route: /^\/loans\/(\d+)\/return$/, handler: postLoanReturn },
  { method: 'POST', route: /^\/tools\/(\d+)\/damage$/, handler: postToolDamage },
  { method: 'POST', route: /^\/tools\/(\d+)\/repair$/, handler: postToolRepair },
  { method: 'GET', route: /^\/tools\/(\d+)\/loan$/, handler: getToolLoan },
  { method: 'GET', route: /^\/tools\/waiting-for-repair$/, handler: getToolsWaitingForRepair },
  { method: 'POST', route: /^\/loans\/(\d+)\/renew$/, handler: postLoanRenew },
];

/**
 * Opens the library over a database, as the API runs it: the Lending domain, with every policy's event handler
 * subscribed to its one outbox. `now` is the clock, so tests can move time; `settings.timeZone` is the library's time
 * zone (default America/New_York). The relay runs once here, so events a crash or a failed handler left undelivered
 * are delivered when the library opens.
 */
export function openLibrary(
  db: Database,
  now: Clock = () => new Date(),
  settings: LibrarySettings = { timeZone: DEFAULT_TIME_ZONE },
): Lending {
  const lending = openLending(db, now, settings.timeZone);
  subscribePolicies(lending.outbox, lending);
  lending.outbox.relay();
  return lending;
}

/**
 * Builds the request handler over the library `openLibrary` opened.
 * Every endpoint's body is read through `readJson`, so the 64 KB limit holds on each (TL-LEND-EP06-R03).
 */
export function createRouter(lending: Lending) {
  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const path = new URL(req.url ?? '/', 'http://localhost').pathname;
      const matching = ROUTES.filter((r) => r.route.test(path));
      if (matching.length === 0) throw new LendingError(404, 'not_found', `There is no route ${path}.`);
      const route = matching.find((r) => r.method === req.method);
      if (!route) throw new LendingError(405, 'method_not_allowed', `${req.method} is not allowed on ${path}.`);
      const params = (path.match(route.route) ?? []).slice(1).map(Number);
      const body = req.method === 'GET' ? {} : await readJson(req);
      const reply = route.handler(lending, params, body);
      send(res, reply.status, reply.body);
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
