// The app bridge (LA-PLT-UC19): how Lathe's MCP server, run by the chat panel's `claude`, reaches the
// window that chat is in. The main process serves it on 127.0.0.1 at a free port, behind a token made
// at start; each chat's CLI gets its window's address and the token in its environment
// (LATHE_APP_BRIDGE and LATHE_APP_TOKEN), which its MCP servers inherit. Two routes per window:
//   GET  <window>/focus   what the Reader is looking at (the page asks the window's page);
//   POST <window>/open    opens a record in the window, { "id": "...", "stage"?: "graph" | "erd" | "trace" }.
// A window that has closed answers 404, so the tools say no app window is connected.
import { randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export const BRIDGE_ENV = 'LATHE_APP_BRIDGE';
export const TOKEN_ENV = 'LATHE_APP_TOKEN';

export interface OpenRequest { id: string; stage: 'graph' | 'erd' | 'trace' | null }
export interface OpenAnswer { ok: boolean; message: string }

export interface BridgeWindows {
  /** What the window's page says the Reader is looking at, or null when the window is gone. */
  focus: (key: string) => Promise<unknown | null>;
  /** Opens a record in the window, or null when the window is gone. */
  open: (key: string, request: OpenRequest) => Promise<OpenAnswer | null>;
}

const STAGES = new Set(['graph', 'erd', 'trace']);

/** An open request, checked: a record ID and an optional stage. */
export function parseOpenRequest(input: unknown): OpenRequest | null {
  if (!input || typeof input !== 'object') return null;
  const { id, stage } = input as Record<string, unknown>;
  if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,120}$/.test(id)) return null;
  if (stage !== undefined && stage !== null && (typeof stage !== 'string' || !STAGES.has(stage))) return null;
  return { id, stage: (stage as OpenRequest['stage']) ?? null };
}

export interface Bridge {
  /** The environment a window's chat gives its CLI. */
  envFor: (key: string) => Record<string, string>;
  close: () => Promise<void>;
}

const send = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

function body(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    let text = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      text += chunk;
      if (text.length > 10_000) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(text));
      } catch {
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
  });
}

/** Starts the bridge on 127.0.0.1 at a free port. */
export async function startBridge(windows: BridgeWindows): Promise<Bridge> {
  const token = randomBytes(24).toString('hex');
  const server: Server = createServer((req, res) => {
    void (async () => {
      if (req.headers.authorization !== `Bearer ${token}`) return send(res, 401, { error: 'This bridge needs its token.' });
      const route = /^\/windows\/([a-z0-9-]+)\/(focus|open)$/.exec(req.url ?? '');
      if (!route) return send(res, 404, { error: 'No such route.' });
      const [, key, action] = route;
      if (action === 'focus' && req.method === 'GET') {
        const focus = await windows.focus(key);
        return focus === null ? send(res, 404, { error: 'That window has closed.' }) : send(res, 200, focus);
      }
      if (action === 'open' && req.method === 'POST') {
        const request = parseOpenRequest(await body(req));
        if (!request) return send(res, 400, { error: 'Give a record ID as id, and optionally a stage: graph, erd or trace.' });
        const answer = await windows.open(key, request);
        return answer === null ? send(res, 404, { error: 'That window has closed.' }) : send(res, 200, answer);
      }
      send(res, 405, { error: 'Method not allowed.' });
    })().catch((error: unknown) => send(res, 500, { error: error instanceof Error ? error.message : String(error) }));
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  return {
    envFor: (key) => ({ [BRIDGE_ENV]: `http://127.0.0.1:${port}/windows/${key}`, [TOKEN_ENV]: token }),
    close: () => new Promise((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    }),
  };
}
