// The MCP server the Claude Code plugin starts (`lathe mcp`): the data commands as tools (add, set, move, link,
// unlink, remove, show, list, next_id and check), with input schemas generated from the schema description, and,
// under the desktop app's chat, the app tools app_focus and app_open (app-tools.ts). It speaks
// JSON-RPC 2.0 over stdio, one message per line. Every write goes through the command layer; a tool's result is the
// rows it changed, or the refusal with its reasons. Writes never commit: the Agent commits per task.
import { createInterface } from 'node:readline';
import { SchemaVersionError } from '../config.ts';
import { APP_TOOLS, appBridgeFromEnv, callAppTool, isAppTool, type AppBridge } from './app-tools.ts';
import type { ColumnDescription, SchemaDescription, TableDescription } from '../store/schema.ts';
import type { Row, Value } from '../store/rows.ts';
import {
  check,
  checkText,
  list,
  listText,
  nextId,
  parentColumns,
  placement,
  readSchema,
  refusalText,
  rowTables,
  show,
  shownText,
  write,
  writtenText,
  type Outcome,
  type WriteRequest,
} from './operations.ts';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonSchema = { [key: string]: Json };

/** One tool as tools/list gives it. */
export interface Tool {
  name: string;
  description: string;
  inputSchema: JsonSchema;
}

function columnSchema(column: ColumnDescription, nullable: boolean, described: boolean): JsonSchema {
  const schema: JsonSchema = ((): JsonSchema => {
    switch (column.kind) {
      case 'integer':
        return { type: 'integer' };
      case 'boolean':
        return { type: 'boolean' };
      case 'date':
        return { type: 'string', format: 'date' };
      case 'enum':
        return { type: 'string', enum: column.values! };
      case 'text_list':
        return { type: 'array', items: { type: 'string', minLength: 1 } };
      default:
        return { type: 'string', minLength: 1 };
    }
  })();
  if (nullable) {
    schema.type = [schema.type as string, 'null'];
    if (schema.enum) schema.enum = [...(schema.enum as string[]), null];
  }
  if (described && column.description) schema.description = column.description;
  return schema;
}

// One property per table, exactly one given: the property's name is the table, its value the row.
function perTable(tables: TableDescription[], row: (table: TableDescription) => JsonSchema, description: string): JsonSchema {
  return {
    type: 'object',
    description,
    properties: Object.fromEntries(tables.map((t) => [t.name, row(t)])),
    minProperties: 1,
    maxProperties: 1,
    additionalProperties: false,
  };
}

function kindIntro(schema: SchemaDescription, table: TableDescription): string {
  const kind = schema.kinds[table.name];
  const parts = [table.description ?? table.name];
  if (kind?.idPattern) parts.push(`ID: ${kind.idPattern}${kind.idExample ? `, such as ${kind.idExample}` : ''}.`);
  if (kind) parts.push(placement(kind));
  return parts.join(' ');
}

/** The tools, their input schemas generated from the schema description. */
const CHECK_TOOL: Tool = {
  name: 'check',
  description: 'Run lathe check on the whole workspace: every error (fix them before going on), every warning (gaps and work still to do), and the recorded exceptions (deliberate deviations with their reasons, never problems).',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
};

export function tools(schema: SchemaDescription): Tool[] {
  const tables = rowTables(schema);
  const kinds = Object.keys(schema.kinds).sort();
  const relations = Object.values(schema.relations).sort((a, b) => a.name.localeCompare(b.name));
  const stored = Object.values(schema.tables).filter((t) => t.stored).map((t) => t.name).sort();
  const id = (description: string): JsonSchema => ({ type: 'string', minLength: 1, description });
  return [
    {
      name: 'add',
      description:
        'Add one row: a record to its kind (give its id, title, its parent column, or one of two for an endpoint, a table or a question, and its fields; ' +
        'a value object, specification, view, integration or UI component has no parent column), or a part row (such as an entity field, a table key, ' +
        'a command change or a use case actor), a declaration or a checking row. ' +
        'Name the table as the only property, with the row as its value. Use next_id for a record\'s ID. Links use link. Returns the rows added, or the refusal with its reasons.',
      inputSchema: perTable(
        tables,
        (t) => {
          const parents = schema.kinds[t.name]?.parents ?? [];
          return {
            type: 'object',
            description: kindIntro(schema, t),
            properties: Object.fromEntries(t.columns.map((c) => [c.name, columnSchema(c, false, true)])),
            required: t.columns.filter((c) => c.required).map((c) => c.name),
            // A kind with two possible parents names exactly one of them.
            ...(parents.length > 1 ? { oneOf: parents.map((p) => ({ required: [p.column] })) } : {}),
            additionalProperties: false,
          };
        },
        'The table to add to, with the row.',
      ),
    },
    {
      name: 'set',
      description:
        'Change columns of one row: name its table as the only property, with its key (id for a record) and the columns to change; null clears a column. ' +
        'Keys never change, and a record\'s parent columns change only with move. Returns the rows changed, or the refusal with its reasons. Column meanings are in add\'s schema.',
      inputSchema: perTable(
        tables,
        (t) => {
          const fixed = parentColumns(schema, t.name);
          const columns = t.columns.filter((c) => t.primaryKey.includes(c.name) || !fixed.has(c.name));
          return {
            type: 'object',
            properties: Object.fromEntries(columns.map((c) => [c.name, columnSchema(c, !t.primaryKey.includes(c.name) && !c.required, false)])),
            required: t.primaryKey,
            minProperties: t.primaryKey.length + 1,
            additionalProperties: false,
          };
        },
        'The table of the row to change, with its key and the changes.',
      ),
    },
    {
      name: 'move',
      description: 'Move a record under another parent of a kind it may sit under. What sits inside it moves along, keeping its IDs. Returns every row changed, or the refusal.',
      inputSchema: { type: 'object', properties: { id: id('The record to move.'), parent: id('Its new parent.') }, required: ['id', 'parent'], additionalProperties: false },
    },
    ...(['link', 'unlink'] as const).map((name) => ({
      name,
      description:
        name === 'link'
          ? 'Link two records with a relation the schema allows between their kinds. Returns the link added, or the refusal.'
          : 'Remove a link between two records. Returns the link removed, or the refusal.',
      inputSchema: {
        type: 'object',
        properties: {
          source: id('The record the link starts at.'),
          relation: {
            type: 'string',
            enum: relations.map((r) => r.name),
            description: `The relation: ${relations.map((r) => `${r.name} (${r.forwardLabel}; ${r.pairs.map((p) => `${p.source}->${p.target}`).join(', ')})`).join('; ')}.`,
          },
          target: id('The record the link ends at.'),
        },
        required: ['source', 'relation', 'target'],
        additionalProperties: false,
      },
    })),
    {
      name: 'remove',
      description:
        'Remove one row: give id for a record (it goes with its parts and the links it starts), or name a part, declaration or checking table with its key. ' +
        'Refused while anything else still references the record, naming what does. Returns the rows removed, or the refusal.',
      inputSchema: {
        type: 'object',
        description: 'Exactly one of id, or a table with its key.',
        properties: {
          id: id('The record to remove.'),
          ...Object.fromEntries(
            tables
              .filter((t) => t.role !== 'kind')
              .map((t) => [
                t.name,
                {
                  type: 'object',
                  properties: Object.fromEntries(t.columns.filter((c) => t.primaryKey.includes(c.name)).map((c) => [c.name, columnSchema(c, false, false)])),
                  required: t.primaryKey,
                  additionalProperties: false,
                },
              ]),
          ),
        },
        minProperties: 1,
        maxProperties: 1,
        additionalProperties: false,
      },
    },
    {
      name: 'show',
      description: 'Read one record: its fields, its parent (or, with no owner, its product or domain), its parts (such as entity fields, table keys or a command\'s recorded changes), its children, and the links it starts and receives.',
      inputSchema: { type: 'object', properties: { id: id('The record.') }, required: ['id'], additionalProperties: false },
    },
    {
      name: 'list',
      description:
        'Read the rows of a table, or only those under a parent: records whose parent columns name it (for a kind with no owner, those of the product or domain), parts it owns, or links that start or end at it.',
      inputSchema: {
        type: 'object',
        properties: { table: { type: 'string', enum: stored, description: 'The table.' }, parent: id('Only the rows under this record.') },
        required: ['table'],
        additionalProperties: false,
      },
    },
    {
      name: 'next_id',
      description:
        'The next free ID for a record of a kind under a parent, by the kind\'s ID pattern. IDs are never reused or renumbered. ' +
        'A kind with one record per parent (a flow, a repository, a constraint test) gives its one ID while it is free.',
      inputSchema: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: kinds, description: 'The kind of the new record.' },
          parent: id('The record it will sit under. For a kind with no owner (value object, specification, view, integration, UI component), the product its ID starts with, or for a specification its domain.'),
        },
        required: ['kind', 'parent'],
        additionalProperties: false,
      },
    },
    CHECK_TOOL,
  ];
}

/** What tools/call returns: text for the Agent, the same as structured content, and isError on a refusal. */
export interface ToolResult {
  content: { type: 'text'; text: string }[];
  structuredContent?: { [key: string]: unknown };
  isError?: boolean;
}

class ArgumentError extends Error {}

const text = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || value.trim() === '') throw new ArgumentError(`${name} is a non-empty string`);
  return value;
};

// The one table property of add, set or remove, with its row.
function single(args: Record<string, unknown>, tool: string): [string, Record<string, unknown>] {
  const entries = Object.entries(args);
  if (entries.length !== 1) throw new ArgumentError(`${tool} takes exactly one property: the table, with the row as its value`);
  const [name, row] = entries[0];
  if (typeof row !== 'object' || row === null || Array.isArray(row)) throw new ArgumentError(`${tool}: ${name} is an object`);
  return [name, row as Record<string, unknown>];
}

function result<T>(outcome: Outcome<T>, describe: (value: T) => string, structured: (value: T) => { [key: string]: unknown }): ToolResult {
  if (!outcome.ok) return { content: [{ type: 'text', text: refusalText(outcome.problems) }], structuredContent: { refused: true, problems: outcome.problems }, isError: true };
  return { content: [{ type: 'text', text: describe(outcome.value) }], structuredContent: structured(outcome.value) };
}

/** Runs one tool on the repo at root; the app tools go to the window's bridge, when there is one. */
export async function callTool(root: string, name: string, args: Record<string, unknown> = {}, app: AppBridge | null = null): Promise<ToolResult> {
  if (isAppTool(name)) return callAppTool(app, name, args);
  try {
    const written = (requests: WriteRequest[]) => write(root, requests).then((o) => result(o, writtenText, (w) => ({ ...w })));
    switch (name) {
      case 'add': {
        const [table, row] = single(args, 'add');
        return await written([{ op: 'add', table, row: row as Row }]);
      }
      case 'set': {
        const [table, fields] = single(args, 'set');
        return await written([{ op: 'set', target: table, fields: fields as Record<string, Value | null> }]);
      }
      case 'remove': {
        const [table, key] = typeof args.id === 'string' && Object.keys(args).length === 1 ? [text(args.id, 'id'), {}] : single(args, 'remove');
        return await written([{ op: 'remove', target: table, fields: key as Record<string, Value> }]);
      }
      case 'move':
        return await written([{ op: 'move', id: text(args.id, 'id'), parent: text(args.parent, 'parent') }]);
      case 'link':
      case 'unlink':
        return await written([{ op: name, source: text(args.source, 'source'), relation: text(args.relation, 'relation'), target: text(args.target, 'target') }]);
      case 'show':
        return result(await show(root, text(args.id, 'id')), shownText, (s) => ({ ...s }));
      case 'list': {
        const table = text(args.table, 'table');
        const parent = args.parent === undefined ? undefined : text(args.parent, 'parent');
        return result(await list(root, table, parent), (rows) => listText(table, rows), (rows) => ({ rows }));
      }
      case 'next_id':
        return result(await nextId(root, text(args.kind, 'kind'), text(args.parent, 'parent')), (id) => id, (id) => ({ id }));
      case 'check': {
        const checked = await check(root);
        return { content: [{ type: 'text', text: checkText(checked) }], structuredContent: { ...checked }, isError: checked.errors > 0 };
      }
      default:
        throw new ArgumentError(`there is no tool ${name}`);
    }
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
              'Every write is validated by the command layer and refused with its reasons when it breaks the model. Writes never commit; commit per task.',
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
