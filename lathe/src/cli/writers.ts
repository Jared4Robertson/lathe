// The CLI's data commands: add, set, move, link, unlink, remove, show, list and next-id. Their field flags and help
// come from the schema description, so every kind, part and column the schema has is a flag, with its type, whether
// it is required, and what it means. Every write goes through the command layer; a refusal prints each reason.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ColumnDescription, SchemaDescription, TableDescription } from '../platform/data/schema.ts';
import type { Value } from '../platform/data/rows.ts';
import type { WriteTool } from './mcp.ts';
import {
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
  type Written,
} from './operations.ts';

/** The commands this module runs. */
export const DATA_COMMANDS = ['add', 'set', 'move', 'link', 'unlink', 'remove', 'show', 'list', 'next-id'] as const;

/** What the data commands add to `lathe help`. */
export const DATA_USAGE = `Data commands (each validates through the command layer and prints every reason on refusal; writes never commit):
  add <table> --<column> <value> ...    Add a record, or a part, declaration or checking row.
  set <id> --<column> <value> ...       Change a record's columns; --<column> "" clears one.
  set <table> --<key> <value> ... --<column> <value> ...
                                        Change a part, declaration or checking row, named by its key columns.
  move <id> --parent <id>               Move a record under another parent; what sits inside it moves along.
  link <from> <relation> <to>           Link two records.
  unlink <from> <relation> <to>         Remove that link.
  remove <id>                           Remove a record with its parts and the links it starts.
  remove <table> --<key> <value> ...    Remove a part, declaration or checking row.
  show <id>                             Print a record, its parts, children and links.
  list <table> [--parent <id>]          Print a table's rows, or those under the parent (for a kind with no owner,
                                        those of the product or domain).
  next-id <kind> --parent <id>          Print the next free ID for a record of the kind under the parent. For a kind
                                        with no owner, --parent names the product (or domain) its ID starts with.
  Add --json for the result as JSON. Run \`lathe add --help\` for the tables, and \`lathe add <table> --help\` for
  a table's columns, from the schema.

  Any write can take its fields as JSON instead of flags, with the result as JSON too: --json - reads stdin,
  --json <file> reads a file. The JSON is what the MCP tool of the same name takes, and an array of them is
  one write, all or nothing. Text keeps its quotes, newlines and backticks as given. For example:
    lathe add --json - <<'EOF'
    {"uc_requirement": {"id": "TL-LEND-UC01-R02", "title": "...", "use_case_id": "TL-LEND-UC01", "statement": "..."}}
    EOF
    lathe set --json - <<< '{"use_case": {"id": "TL-LEND-UC01", "notes": null}}'
    lathe move --json move.json          {"id": "...", "parent": "..."}
    lathe link --json links.json         [{"source": "...", "relation": "fulfills", "target": "..."}, ...]
    lathe remove --json - <<< '{"id": "TL-LEND-UC01-R02"}'
  With --json <file> or -, give no table, ID or field flags: the JSON names them.
`;

class UsageError extends Error {}

interface Parsed {
  positionals: string[];
  /** Each flag's values, in order: a flag given twice has two. */
  flags: Map<string, string[]>;
}

// Reads --name value and --name=value; a flag with no value after it (or before another flag) is "true".
function parse(args: string[]): Parsed {
  const positionals: string[] = [];
  const flags = new Map<string, string[]>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--') || arg === '--') {
      positionals.push(arg);
      continue;
    }
    const eq = arg.indexOf('=');
    const name = eq > 0 ? arg.slice(2, eq) : arg.slice(2);
    let value: string;
    if (eq > 0) value = arg.slice(eq + 1);
    else if (i + 1 < args.length && !args[i + 1].startsWith('--')) value = args[++i];
    else value = 'true';
    flags.set(name, [...(flags.get(name) ?? []), value]);
  }
  return { positionals, flags };
}

const GLOBAL_FLAGS = new Set(['root', 'json', 'help']);

// A flag's text as its column's value: a whole number, true or false, a list (the flag given once per item), or text.
function columnValue(table: TableDescription, column: ColumnDescription, raw: string[]): Value {
  const flag = `--${column.name}`;
  if (column.kind === 'text_list') return raw;
  if (raw.length > 1) throw new UsageError(`${flag} is given ${raw.length} times; ${table.name}.${column.name} takes one value.`);
  const text = raw[0];
  if (column.kind === 'integer') {
    if (!/^-?\d+$/.test(text)) throw new UsageError(`${flag} ${JSON.stringify(text)}: ${table.name}.${column.name} is a whole number.`);
    return Number(text);
  }
  if (column.kind === 'boolean') {
    if (text !== 'true' && text !== 'false') throw new UsageError(`${flag} ${JSON.stringify(text)}: ${table.name}.${column.name} is true or false.`);
    return text === 'true';
  }
  return text;
}

// The flags that name columns, as the table's values; every other flag is an error naming the table's columns.
function fields(table: TableDescription, flags: Map<string, string[]>, options: { clear: boolean }): Record<string, Value | null> {
  const values: Record<string, Value | null> = {};
  for (const [name, raw] of flags) {
    if (GLOBAL_FLAGS.has(name)) continue;
    const column = table.columns.find((c) => c.name === name);
    if (!column) throw new UsageError(`${table.name} has no column ${name}; its columns are ${table.columns.map((c) => c.name).join(', ')}. Run \`lathe add ${table.name} --help\`.`);
    values[name] = options.clear && raw.length === 1 && raw[0] === '' ? null : columnValue(table, column, raw);
  }
  return values;
}

const ROLE_ORDER = ['kind', 'part', 'declaration', 'checking'];

function columnLine(schema: SchemaDescription, table: TableDescription, column: ColumnDescription): string {
  const type = column.kind === 'enum' ? `one of ${column.values!.join(', ')}` : column.kind === 'text_list' ? 'text, the flag once per item' : column.kind;
  const notes = [type];
  if (column.required) notes.push('required');
  if (table.primaryKey.includes(column.name)) notes.push('key');
  if (parentColumns(schema, table.name).has(column.name)) notes.push('parent');
  return `  --${column.name.padEnd(24)} ${notes.join(', ')}. ${column.description ?? ''}`.trimEnd();
}

/** The help for add (and set and remove): every table, or one table's columns, read from the schema. */
export function tableHelp(schema: SchemaDescription, name?: string): string {
  if (name === undefined) {
    const tables = rowTables(schema).sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.name.localeCompare(b.name));
    const lines = ['Tables a row can be added to (run `lathe add <table> --help` for its columns):'];
    let role = '';
    for (const t of tables) {
      if (t.role !== role) lines.push(`\n${t.role === 'kind' ? 'Kinds' : t.role === 'part' ? 'Parts' : t.role === 'declaration' ? 'Declarations' : 'Checking'}:`);
      role = t.role;
      lines.push(`  ${t.name.padEnd(26)} ${t.description ?? ''}`.trimEnd());
    }
    lines.push('\nLinks use `lathe link <from> <relation> <to>`. Relations:');
    for (const r of Object.values(schema.relations).sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(`  ${r.name.padEnd(26)} ${r.pairs.map((p) => `${p.source} -> ${p.target}`).join(', ')}`);
    }
    return lines.join('\n');
  }
  const table = schema.tables[name];
  if (!table || !table.stored || table.role === 'link') throw new UsageError(`There is no table ${name} to add rows to. Run \`lathe add --help\` for the tables.`);
  const kind = schema.kinds[name];
  const lines = [`lathe add ${name} --<column> <value> ...`, '', table.description ?? ''];
  if (kind) {
    lines.push('', `ID: ${kind.idPattern ?? 'any'}${kind.idExample ? `, such as ${kind.idExample}` : ''}. ${placement(kind)}`);
  }
  lines.push('', 'Columns:', ...table.columns.map((c) => columnLine(schema, table, c)));
  return lines.join('\n');
}

const relative = (root: string, file: string) => path.relative(root, file) || file;

/** Where a data command writes, and reads the JSON `--json -` names. */
export interface DataIo {
  out: (text: string) => void;
  err: (text: string) => void;
  stdin?: () => Promise<string>;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

// A write's fields given as JSON (--json - or --json <file>): the MCP tool's arguments, or an array of them as one
// write. Each item is read by the tool's own reader (mcp.ts), so the CLI has no second parser of fields.
async function jsonWrite(root: string, command: WriteTool, source: string, io: DataIo): Promise<Outcome<Written>> {
  let text: string;
  try {
    text = source === '-' ? await (io.stdin ?? readStdin)() : await readFile(path.resolve(source), 'utf8');
  } catch (error) {
    throw new UsageError(`--json ${source}: could not read it (${error instanceof Error ? error.message : String(error)}).`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new UsageError(`--json ${source} is not JSON: ${error instanceof Error ? error.message : String(error)}.`);
  }
  const items = Array.isArray(parsed) ? parsed : [parsed];
  if (!items.length) throw new UsageError(`--json ${source} is an empty array; give at least one ${command}.`);
  const { ArgumentError, writeRequests } = await import('./mcp.ts');
  const requests: WriteRequest[] = [];
  const problems: { rule: string; message: string }[] = [];
  items.forEach((item, at) => {
    const which = Array.isArray(parsed) ? `item ${at + 1}: ` : '';
    try {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) throw new ArgumentError(`${command} takes an object`);
      requests.push(writeRequests(command, item as Record<string, unknown>));
    } catch (error) {
      if (!(error instanceof ArgumentError)) throw error;
      problems.push({ rule: 'arguments', message: `${which}${error.message}` });
    }
  });
  if (problems.length) return { ok: false, problems };
  return write(root, requests);
}

/** Runs one data command; returns the exit code: 0 done, 1 refused, 2 bad usage. */
export async function runDataCommand(args: string[], io: DataIo = { out: (t) => console.log(t), err: (t) => console.error(t) }): Promise<number> {
  const { positionals, flags } = parse(args);
  const [command, ...rest] = positionals;
  const root = path.resolve(flags.get('root')?.at(-1) ?? process.cwd());
  const json = flags.has('json');
  const one = (name: string): string | undefined => {
    const values = flags.get(name);
    if (values && values.length > 1) throw new UsageError(`--${name} is given more than once.`);
    return values?.[0];
  };
  const report = <T>(outcome: Outcome<T>, text: (value: T) => string): number => {
    if (!outcome.ok) {
      if (json) io.out(JSON.stringify({ refused: true, problems: outcome.problems }, null, 2));
      else io.err(refusalText(outcome.problems));
      return 1;
    }
    io.out(json ? JSON.stringify(outcome.value, null, 2) : text(outcome.value));
    return 0;
  };
  const only = (allowed: string[]) => {
    const extra = [...flags.keys()].filter((f) => !GLOBAL_FLAGS.has(f) && !allowed.includes(f));
    if (extra.length) throw new UsageError(`lathe ${command} takes no ${extra.map((f) => `--${f}`).join(', ')}.`);
  };
  const positionalCount = (n: number, shape: string) => {
    if (rest.length !== n) throw new UsageError(`lathe ${command} needs ${shape}.`);
  };

  try {
    if (flags.has('help') && ['add', 'set', 'remove'].includes(command)) {
      const schema = await readSchema(root);
      io.out(tableHelp(schema, rest[0] && schema.tables[rest[0]] ? rest[0] : undefined));
      return 0;
    }
    if (flags.has('help')) {
      io.out(DATA_USAGE);
      return 0;
    }
    // --json with a value names where the write's fields are; bare, it only asks for the result as JSON.
    const source = one('json');
    if (source !== undefined && source !== 'true') {
      // The MCP server is loaded only for a write given as JSON, so every other command starts sooner.
      const { isWriteTool } = await import('./mcp.ts');
      if (!isWriteTool(command)) throw new UsageError(`lathe ${command} takes no fields as JSON; give --json alone for the result as JSON.`);
      const fieldFlags = [...flags.keys()].filter((f) => !GLOBAL_FLAGS.has(f));
      if (fieldFlags.length) throw new UsageError(`lathe ${command} takes its fields from --json ${source} or from flags, not both; drop ${fieldFlags.map((f) => `--${f}`).join(', ')}.`);
      if (rest.length) throw new UsageError(`lathe ${command} --json ${source} takes no ${rest.join(' ')}: the JSON names the ${command === 'add' ? 'table' : 'records'}.`);
      return report(await jsonWrite(root, command, source, io), writtenText);
    }
    switch (command) {
      case 'add': {
        positionalCount(1, 'a table: lathe add <table> --<column> <value> ...');
        const name = rest[0];
        const outcome = await write(root, (store) => {
          const table = store.schema.tables[name];
          // A table that takes no rows is the command layer's to refuse, with its reason.
          const row = table?.stored && table.role !== 'link' ? fields(table, flags, { clear: false }) : {};
          return [{ op: 'add', table: name, row: row as Record<string, Value> }];
        });
        return report(outcome, writtenText);
      }
      case 'set':
      case 'remove': {
        positionalCount(1, `an ID or a table: lathe ${command} <id> ... or lathe ${command} <table> --<key> <value> ...`);
        const target = rest[0];
        const outcome = await write(root, (store): WriteRequest[] => {
          const record = store.record(target);
          const table = store.schema.tables[target] ?? (record ? store.schema.tables[record.kind] : undefined);
          const values = table ? fields(table, flags, { clear: command === 'set' }) : {};
          return [command === 'set' ? { op: 'set', target, fields: values } : { op: 'remove', target, fields: values as Record<string, Value> }];
        });
        return report(outcome, writtenText);
      }
      case 'move': {
        positionalCount(1, 'an ID and a parent: lathe move <id> --parent <id>');
        only(['parent']);
        const parent = one('parent');
        if (!parent || parent === 'true') throw new UsageError('lathe move needs --parent <id>.');
        return report(await write(root, [{ op: 'move', id: rest[0], parent }]), writtenText);
      }
      case 'link':
      case 'unlink': {
        positionalCount(3, `lathe ${command} <from> <relation> <to>`);
        only([]);
        const [source, relation, target] = rest;
        return report(await write(root, [{ op: command, source, relation, target }]), writtenText);
      }
      case 'show': {
        positionalCount(1, 'an ID: lathe show <id>');
        only([]);
        return report(await show(root, rest[0]), shownText);
      }
      case 'list': {
        positionalCount(1, 'a table: lathe list <table> [--parent <id>]');
        only(['parent']);
        const parent = one('parent');
        return report(await list(root, rest[0], parent), (rows) => listText(rest[0], rows));
      }
      case 'next-id': {
        positionalCount(1, 'a kind and a parent: lathe next-id <kind> --parent <id>');
        only(['parent']);
        const parent = one('parent');
        if (!parent || parent === 'true') throw new UsageError('lathe next-id needs --parent <id>.');
        return report(await nextId(root, rest[0], parent), (id) => id);
      }
      default:
        throw new UsageError(`Unknown data command "${command}".`);
    }
  } catch (error) {
    if (error instanceof UsageError) {
      io.err(`${error.message}\n\n${DATA_USAGE}`);
      return 2;
    }
    io.err(`lathe ${command} failed in ${relative(process.cwd(), root)}: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
}
