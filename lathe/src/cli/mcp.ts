// The MCP server the Claude Code plugin starts (`lathe mcp`): one tool per aggregate command and query
// (use_case_add_flow_step, use_case_get_use_case; aggregates.ts), each running the one command or query it names, and
// the check; under the desktop app's chat, also the app tools app_focus and app_open (app-tools.ts). It speaks
// JSON-RPC 2.0 over stdio, one message per line. A tool's result is the rows its command changed, or what its query
// read, or the refusal with every reason. Writes never commit: the Agent commits per task.
import { createInterface } from 'node:readline';
import { SchemaVersionError } from '../config.ts';
import { aggregateTool, aggregateTools, runDefinition } from './aggregates.ts';
import { APP_TOOLS, appBridgeFromEnv, callAppTool, isAppTool, type AppBridge } from './app-tools.ts';
import type { SchemaDescription } from '../platform/data/schema.ts';
import { check, checkText, readSchema, refusalText, type Outcome } from './operations.ts';

/** One tool as tools/list gives it. */
export interface Tool {
  name: string;
  description: string;
  inputSchema: { [key: string]: unknown };
}

/** The check, the one tool that is no aggregate's command or query. */
const CHECK_TOOL: Tool = {
  name: 'check',
  description:
    'Run lathe check on the whole workspace: every error (fix them before going on), every warning (work still to do), ' +
    'and each product\'s coverage as lathe check --json gives it: per domain and obligation kind, how many are designed, built and proved, with its gaps (what each obligation still lacks, and each record short of a minimum, such as interface-without-flow).',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
};

/** The tools: the check, then one per aggregate command and query, each with its input schema from its fields. */
export function tools(schema: SchemaDescription): Tool[] {
  return [CHECK_TOOL, ...aggregateTools(schema)];
}

/** What tools/call returns: text for the Agent, the same as structured content, and isError on a refusal. */
export interface ToolResult {
  content: { type: 'text'; text: string }[];
  structuredContent?: { [key: string]: unknown };
  isError?: boolean;
}

/** A tool that is not there: refused before anything is read or written. */
class ArgumentError extends Error {}

function result<T>(outcome: Outcome<T>, describe: (value: T) => string, structured: (value: T) => { [key: string]: unknown }): ToolResult {
  if (!outcome.ok) return { content: [{ type: 'text', text: refusalText(outcome.problems) }], structuredContent: { refused: true, problems: outcome.problems }, isError: true };
  return { content: [{ type: 'text', text: describe(outcome.value) }], structuredContent: structured(outcome.value) };
}

/** Runs one tool on the repo at root; the app tools go to the window's bridge, when there is one. */
export async function callTool(root: string, name: string, args: Record<string, unknown> = {}, app: AppBridge | null = null): Promise<ToolResult> {
  if (isAppTool(name)) return callAppTool(app, name, args);
  try {
    const own = aggregateTool(name);
    if (own) return result(await runDefinition(root, own, args), (v) => v.text, (v) => (typeof v.json === 'object' && v.json !== null && !Array.isArray(v.json) ? { ...v.json } : { answer: v.json }));
    if (name !== CHECK_TOOL.name) throw new ArgumentError(`there is no tool ${name}`);
    const checked = await check(root);
    return { content: [{ type: 'text', text: checkText(checked) }], structuredContent: { ...checked }, isError: checked.errors > 0 };
  } catch (error) {
    // The product's data is for another schema version: every tool says what to do, and nothing changes.
    if (error instanceof SchemaVersionError) return { content: [{ type: 'text', text: error.message }], structuredContent: { refused: true, problems: [{ rule: 'schema-version', message: error.message }] }, isError: true };
    if (!(error instanceof ArgumentError)) throw error;
    return { content: [{ type: 'text', text: `Refused; nothing changed: ${error.message}.` }], structuredContent: { refused: true, problems: [{ rule: 'arguments', message: error.message }] }, isError: true };
  }
}

const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const DECLARATIONS = new Set(['product_kind', 'product_kind_field', 'product_relation']);

interface Message {
  jsonrpc: '2.0';
  id?: string | number | null;
  method?: string;
  params?: { [key: string]: unknown };
}

/** Serves the tools for the repo at root over the given streams until input ends; the app tools only with an app bridge. */
export async function serveMcp(root: string, input: NodeJS.ReadableStream = process.stdin, output: NodeJS.WritableStream = process.stdout, app: AppBridge | null = appBridgeFromEnv()): Promise<void> {
  // A product whose data is for another schema version still gets a server: its one tool, check, says what to do.
  let mismatch: SchemaVersionError | null = null;
  let schema: SchemaDescription | null = await readSchema(root).catch((error: unknown) => {
    if (!(error instanceof SchemaVersionError)) throw error;
    mismatch = error;
    return null;
  });
  const send = (message: object) => output.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
  const reply = (id: Message['id'], body: { result: unknown } | { error: { code: number; message: string } }) => send({ id, ...body });

  const handle = async (message: Message) => {
    const { id, method, params = {} } = message;
    const isRequest = id !== undefined && id !== null;
    switch (method) {
      case 'initialize': {
        const asked = String(params.protocolVersion ?? '');
        reply(id, {
          result: {
            protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
            capabilities: { tools: { listChanged: true } },
            serverInfo: { name: 'lathe', version: '1.0.0' },
            instructions:
              (mismatch ? `${(mismatch as SchemaVersionError).message} Until then, only the check tool runs, and it says the same. ` : '') +
              'Lathe keeps the spec as typed data in data/*.jsonl. Change it only with these tools, never by editing the files. ' +
              'Each tool is one aggregate\'s command or query, named <aggregate>_<command> (use_case_add_flow_step, use_case_get_use_case): ' +
              'a command checks its aggregate\'s rules and is refused, with every reason, when it breaks them; a query reads its aggregate\'s own read model. ' +
              'Writes never commit; commit per task.',
          },
        });
        return;
      }
      case 'ping':
        if (isRequest) reply(id, { result: {} });
        return;
      case 'tools/list':
        reply(id, { result: { tools: [...(schema ? tools(schema) : [CHECK_TOOL]), ...(app ? APP_TOOLS : [])] } });
        return;
      case 'tools/call': {
        const name = String(params.name ?? '');
        const args = (params.arguments ?? {}) as Record<string, unknown>;
        const called = await callTool(root, name, args, app);
        reply(id, { result: called });
        // A product's own kinds or relations changed: the tools' schemas change with them.
        const changes = (called.structuredContent?.changes ?? []) as { table: string }[];
        if (schema && changes.some((c) => DECLARATIONS.has(c.table))) {
          schema = await readSchema(root);
          send({ method: 'notifications/tools/list_changed' });
        }
        return;
      }
      default:
        if (isRequest) reply(id, { error: { code: -32601, message: `Method not found: ${method}` } });
    }
  };

  const lines = createInterface({ input, crlfDelay: Infinity });
  // One message at a time, so writes apply in the order they were sent.
  let queue = Promise.resolve();
  for await (const line of lines) {
    if (!line.trim()) continue;
    let message: Message;
    try {
      message = JSON.parse(line) as Message;
    } catch {
      send({ id: null, error: { code: -32700, message: 'Parse error' } });
      continue;
    }
    queue = queue.then(() =>
      handle(message).catch((error: unknown) => {
        if (message.id !== undefined && message.id !== null) reply(message.id, { error: { code: -32603, message: error instanceof Error ? error.message : String(error) } });
      }),
    );
  }
  await queue;
}
