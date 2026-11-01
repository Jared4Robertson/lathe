// The MCP server's two app tools (LA-PLT-UC29-R01), for Claude Code run by the desktop app's chat panel:
// app_focus says what the Reader is looking at in the window (the focused record, the stage, the
// selection), and app_open opens a record there. The desktop app gives the chat's CLI the window's
// bridge address and its token (LATHE_APP_BRIDGE, LATHE_APP_TOKEN, desktop/src/bridge.ts), which the
// CLI's MCP servers and shell commands inherit; the tools are listed only then, and refuse once the window
// has closed. `lathe app focus` and `lathe app open` (LA-PLT-UC29-R02) run the same calls from the shell.
import { parseArgs } from 'node:util';

export interface AppBridge {
  /** The window's address on the app bridge, such as http://127.0.0.1:50123/windows/<key>. */
  url: string;
  token: string;
}

/** The bridge the environment names, when this server runs under the desktop app's chat. */
export function appBridgeFromEnv(env: NodeJS.ProcessEnv = process.env): AppBridge | null {
  const url = env.LATHE_APP_BRIDGE;
  const token = env.LATHE_APP_TOKEN;
  return url && token && /^http:\/\/127\.0\.0\.1:\d+\//.test(url) ? { url, token } : null;
}

export const APP_TOOLS = [
  {
    name: 'app_focus',
    description:
      'What the Reader is looking at in the Lathe app window this chat runs in: the page, the focused record (its ID, kind and title), the stage (graph, erd or trace) and the record selected on the stage or in the wiki card, if any. ' +
      'Use it to resolve "this", "here" or "the selected one", and for anything about the window, instead of searching the code. Works only while the window is open.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'app_open',
    description:
      'Open a record in the Lathe app window this chat runs in, so the Reader sees it: the window moves its focus to the record, on the stage given or the one shown. ' +
      'Refused when the window has no such record or is closed.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', minLength: 1, description: 'The record to open.' },
        stage: { type: 'string', enum: ['graph', 'erd', 'trace'], description: 'The stage to show it on; the one shown when left out.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    // It changes what the window shows, never the spec.
    annotations: { readOnlyHint: false },
  },
] as const;

export const isAppTool = (name: string) => APP_TOOLS.some((t) => t.name === name);

interface Named { id: string; kind: string; title: string }
/** What the window's page says it shows (app/src/chat/appRequests.ts). */
export interface AppFocus {
  page: { path: string; product: string | null; stage: string | null; focus: Named | null; selected: Named | null; wikiCard: boolean | null } | null;
}

const named = (n: Named) => `${n.id} (${n.kind}): ${n.title}`;

/** The focus as a sentence or two for the Agent. */
export function focusText(focus: AppFocus): string {
  const page = focus.page;
  if (!page) return 'The window shows no page yet.';
  const lines = [page.focus ? `The Reader is looking at ${named(page.focus)}` : `The Reader is on ${page.path}, which has no record in focus`];
  if (page.focus && page.stage) lines[0] += `, on the ${page.stage} stage`;
  lines[0] += '.';
  if (page.selected) lines.push(`Selected: ${named(page.selected)}.`);
  if (page.product) lines.push(`Product: ${page.product}.`);
  lines.push(`Page: ${page.path}`);
  return lines.join('\n');
}

type Result = { content: { type: 'text'; text: string }[]; structuredContent?: { [key: string]: unknown }; isError?: boolean };
const refused = (text: string): Result => ({ content: [{ type: 'text', text }], structuredContent: { refused: true, problems: [{ rule: 'app', message: text }] }, isError: true });
const NOT_CONNECTED =
  'No Lathe app window is connected: app_focus and app_open (lathe app focus and lathe app open) work only in the chat of the Lathe desktop app, while its window is open.';

/** Runs app_focus or app_open against the window's bridge. */
export async function callAppTool(app: AppBridge | null, name: string, args: Record<string, unknown>): Promise<Result> {
  if (!app) return refused(NOT_CONNECTED);
  const headers = { authorization: `Bearer ${app.token}`, 'content-type': 'application/json' };
  let res: Response;
  try {
    if (name === 'app_focus') res = await fetch(`${app.url}/focus`, { headers, signal: AbortSignal.timeout(8000) });
    else {
      if (typeof args.id !== 'string' || !args.id.trim()) return refused('Refused; nothing changed: id is a non-empty string.');
      if (args.stage !== undefined && !['graph', 'erd', 'trace'].includes(String(args.stage))) return refused('Refused; nothing changed: stage is graph, erd or trace.');
      res = await fetch(`${app.url}/open`, { method: 'POST', headers, body: JSON.stringify({ id: args.id.trim(), stage: args.stage ?? null }), signal: AbortSignal.timeout(8000) });
    }
  } catch {
    return refused(NOT_CONNECTED);
  }
  if (res.status === 404 || res.status === 401) return refused(NOT_CONNECTED);
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !body) return refused(typeof body?.error === 'string' ? body.error : `The app answered ${res.status}.`);
  if (name === 'app_focus') return { content: [{ type: 'text', text: focusText(body as unknown as AppFocus) }], structuredContent: body };
  const ok = body.ok === true;
  const message = typeof body.message === 'string' ? body.message : ok ? 'Opened.' : 'Not opened.';
  return ok ? { content: [{ type: 'text', text: message }], structuredContent: { opened: args.id } } : refused(message);
}

/** What the app commands add to `lathe help`. */
export const APP_USAGE = `App commands (the MCP tools app_focus and app_open from a shell; they work only in the chat of the Lathe
desktop app, while its window is open):
  app focus                             Print what the Reader is looking at: the page, the focused record, the
                                        stage and the record selected.
  app open <id> [--stage graph|erd|trace]
                                        Open a record in the window, on the stage given or the one shown.
  Add --json for the result as JSON. With no window connected, each is refused and exits 1.
`;

const parse = (args: string[]) =>
  parseArgs({ args, allowPositionals: true, options: { json: { type: 'boolean' }, stage: { type: 'string' }, root: { type: 'string' }, help: { type: 'boolean' } } });

/** Runs `lathe app focus` or `lathe app open` through callAppTool; returns the exit code: 0 done, 1 refused, 2 bad usage. */
export async function runAppCommand(
  args: string[],
  io: { out: (text: string) => void; err: (text: string) => void } = { out: (t) => console.log(t), err: (t) => console.error(t) },
  app: AppBridge | null = appBridgeFromEnv(),
): Promise<number> {
  const usage = (message: string) => {
    io.err(`${message}\n\n${APP_USAGE}`);
    return 2;
  };
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(args);
  } catch (error) {
    return usage(error instanceof Error ? error.message : String(error));
  }
  const { positionals, values } = parsed;
  const [, action, ...rest] = positionals;
  if (values.help) {
    io.out(APP_USAGE);
    return 0;
  }
  let called: Result;
  if (action === 'focus') {
    if (rest.length || values.stage !== undefined) return usage('lathe app focus takes no ID or --stage.');
    called = await callAppTool(app, 'app_focus', {});
  } else if (action === 'open') {
    if (rest.length !== 1) return usage('lathe app open needs one record ID: lathe app open <id> [--stage graph|erd|trace].');
    called = await callAppTool(app, 'app_open', { id: rest[0], ...(values.stage !== undefined ? { stage: values.stage } : {}) });
  } else {
    return usage(action ? `Unknown app command "${action}".` : 'lathe app needs focus or open.');
  }
  const text = called.content.map((c) => c.text).join('\n');
  if (values.json) io.out(JSON.stringify(called.structuredContent ?? {}, null, 2));
  else if (called.isError) io.err(text);
  else io.out(text);
  return called.isError ? 1 : 0;
}
