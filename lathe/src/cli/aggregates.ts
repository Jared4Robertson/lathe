// The CLI and MCP tools of every aggregate's commands and queries: `lathe <aggregate> <command>` and one tool per
// command or query (use_case_add_flow_step). Each is registered by name from the aggregate's own list (commands.ts),
// so each runs the one command it names. A command's fields come as flags (--<field> <value>, a list's flag once per
// item) or as JSON (--json - reads stdin, --json <file> a file): the same JSON the command's MCP tool takes.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ALL_COMMANDS, ALL_QUERIES } from '../commands.ts';
import { fieldHelp, flagValue, InputError, inputSchema, toolName, type AnyCommand, type AnyQuery } from '../platform/commands/definition.ts';
import { committedText, runCommand, runQuery } from '../platform/commands/run.ts';
import type { ReadView } from '../platform/data/rules.ts';
import type { SchemaDescription } from '../platform/data/schema.ts';
import type { Store } from '../platform/data/store.ts';
import { loadConfig, readWorkspace } from '../index.ts';
import type { Tool } from './mcp.ts';
import { readSchema, refusalText, withStore, type Outcome } from './operations.ts';

/** The aggregates the CLI names, such as use-case: each is a command of its own, `lathe use-case ...`. */
export const AGGREGATE_COMMANDS: readonly string[] = [...new Set([...ALL_COMMANDS, ...ALL_QUERIES].map((d) => d.slice.name))].sort();

type Definition = { kind: 'command'; definition: AnyCommand } | { kind: 'query'; definition: AnyQuery };

const definitions: Definition[] = [
  ...ALL_COMMANDS.map((definition) => ({ kind: 'command' as const, definition })),
  ...ALL_QUERIES.map((definition) => ({ kind: 'query' as const, definition })),
];

/** What `lathe help` says of the aggregates' commands. */
export const AGGREGATE_USAGE = `Aggregate commands (each checks its aggregate's rules and prints every reason on refusal; writes never commit):
${AGGREGATE_COMMANDS.map((a) => `  ${a} <command> --<field> <value> ...   Run \`lathe ${a} --help\` for its commands.`).join('\n')}
  Any of them takes its fields as JSON instead: --json - reads stdin, --json <file> a file; the JSON is what the
  command's MCP tool takes. Bare --json prints the result as JSON.
`;

/** Runs a definition on the product at root with the arguments: what it changed or answered, or the refusal. */
export async function runDefinition(root: string, found: Definition, args: unknown): Promise<Outcome<{ text: string; json: unknown }>> {
  try {
    return await withStore(root, async (store) => {
      if (found.kind === 'query') {
        const answer = runQuery(found.definition.checked ? await checkedView(root, store) : store, found.definition, args);
        return { text: found.definition.text(answer as never), json: answer };
      }
      const committed = await runCommand(store, found.definition, args);
      return { text: committedText(committed), json: committed };
    });
  } catch (error) {
    if (error instanceof InputError) return { ok: false, problems: [{ rule: 'input', message: error.message }] };
    throw error;
  }
}

/** The store's data with the checks' run over it, for a query that reads the run: the checks run first, as `lathe check` runs them. */
async function checkedView(root: string, store: Store): Promise<ReadView> {
  const { problems, coverage, chains } = await readWorkspace(store, loadConfig(root));
  return { schema: store.schema, rows: (table) => store.rows(table), record: (id) => store.record(id), checked: { problems, coverage, chains } };
}

// ---------- MCP ----------

/** One MCP tool per command and query, with its input schema from its fields and the schema's column descriptions. */
export function aggregateTools(schema: SchemaDescription): Tool[] {
  return definitions.map(({ definition }) => ({
    name: toolName(definition),
    description: `${definition.description} (${definition.id})`,
    inputSchema: inputSchema(schema, definition.input) as Tool['inputSchema'],
  }));
}

/** The command or query a tool runs, by the tool's name. */
export function aggregateTool(name: string): Definition | undefined {
  return definitions.find((d) => toolName(d.definition) === name);
}

// ---------- CLI ----------

class UsageError extends Error {}

interface Io {
  out: (text: string) => void;
  err: (text: string) => void;
  stdin?: () => Promise<string>;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

// --name value and --name=value; a flag with nothing after it is "true".
function parse(args: string[]): { positionals: string[]; flags: Map<string, string[]> } {
  const positionals: string[] = [];
  const flags = new Map<string, string[]>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }
    const eq = arg.indexOf('=');
    const name = eq > 0 ? arg.slice(2, eq) : arg.slice(2);
    const value = eq > 0 ? arg.slice(eq + 1) : i + 1 < args.length && !args[i + 1].startsWith('--') ? args[++i] : 'true';
    flags.set(name, [...(flags.get(name) ?? []), value]);
  }
  return { positionals, flags };
}

function definitionHelp(schema: SchemaDescription, aggregate: string, found: Definition): string {
  const { definition } = found;
  return [
    `lathe ${aggregate} ${definition.name} --<field> <value> ... | --json <file|->`,
    '',
    `${definition.description} (${definition.id})`,
    '',
    'Fields:',
    ...Object.entries(definition.input).map(([name, field]) => fieldHelp(schema, name, field)),
  ].join('\n');
}

function aggregateHelp(aggregate: string): string {
  const own = definitions.filter((d) => d.definition.slice.name === aggregate);
  return [
    `lathe ${aggregate} <command> --<field> <value> ... | --json <file|->`,
    '',
    'Commands:',
    ...own.filter((d) => d.kind === 'command').map((d) => `  ${d.definition.name.padEnd(24)} ${d.definition.description}`),
    '',
    'Queries:',
    ...own.filter((d) => d.kind === 'query').map((d) => `  ${d.definition.name.padEnd(24)} ${d.definition.description}`),
    '',
    `Run \`lathe ${aggregate} <command> --help\` for its fields.`,
  ].join('\n');
}

/** Runs `lathe <aggregate> <command> ...`; returns the exit code: 0 done, 1 refused, 2 bad usage. */
export async function runAggregateCommand(args: string[], io: Io = { out: (t) => console.log(t), err: (t) => console.error(t) }): Promise<number> {
  const { positionals, flags } = parse(args);
  const [aggregate, name, ...rest] = positionals;
  const root = path.resolve(flags.get('root')?.at(-1) ?? process.cwd());
  try {
    if (!name) {
      if (!flags.has('help')) throw new UsageError(`lathe ${aggregate} needs a command.`);
      io.out(aggregateHelp(aggregate));
      return 0;
    }
    const found = definitions.find((d) => d.definition.slice.name === aggregate && d.definition.name === name);
    if (!found) throw new UsageError(`lathe ${aggregate} has no command ${name}.`);
    if (rest.length) throw new UsageError(`lathe ${aggregate} ${name} takes no ${rest.join(' ')}; give its fields as --<field> <value>.`);
    const schema = await readSchema(root);
    if (flags.has('help')) {
      io.out(definitionHelp(schema, aggregate, found));
      return 0;
    }
    const source = flags.get('json')?.at(-1);
    const fieldFlags = [...flags.keys()].filter((f) => f !== 'root' && f !== 'json');
    let input: Record<string, unknown> = {};
    if (source !== undefined && source !== 'true') {
      if (fieldFlags.length) throw new UsageError(`Give the fields from --json ${source} or as flags, not both; drop ${fieldFlags.map((f) => `--${f}`).join(', ')}.`);
      let text: string;
      try {
        text = source === '-' ? await (io.stdin ?? readStdin)() : await readFile(path.resolve(source), 'utf8');
      } catch (error) {
        throw new UsageError(`--json ${source}: could not read it (${error instanceof Error ? error.message : String(error)}).`);
      }
      try {
        input = JSON.parse(text) as Record<string, unknown>;
      } catch (error) {
        throw new UsageError(`--json ${source} is not JSON: ${error instanceof Error ? error.message : String(error)}.`);
      }
    } else {
      for (const flag of fieldFlags) {
        const field = found.definition.input[flag];
        if (!field) throw new UsageError(`lathe ${aggregate} ${name} has no field ${flag}; its fields are ${Object.keys(found.definition.input).join(', ')}.`);
        input[flag] = flagValue(schema, flag, field, flags.get(flag)!);
      }
    }
    const outcome = await runDefinition(root, found, input);
    const json = source !== undefined;
    if (!outcome.ok) {
      if (json) io.out(JSON.stringify({ refused: true, problems: outcome.problems }, null, 2));
      else io.err(refusalText(outcome.problems));
      return 1;
    }
    io.out(json ? JSON.stringify(outcome.value.json, null, 2) : outcome.value.text);
    return 0;
  } catch (error) {
    if (error instanceof UsageError || error instanceof InputError) {
      io.err(`${error.message}\n\n${name && definitions.some((d) => d.definition.slice.name === aggregate) ? `Run \`lathe ${aggregate} --help\`.` : AGGREGATE_USAGE}`);
      return 2;
    }
    io.err(`lathe ${aggregate} ${name ?? ''} failed: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
}
