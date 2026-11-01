// The identities of Lathe's own commands and queries, generated from its records: each command's and query's ID,
// slice, name, description, method and route, one `as const` object per definition in its slice's
// commands/identities.generated.ts or queries.generated.ts, which the hand-written definition spreads; each slice's
// commands/index.ts list; and the registry, src/commands.ts. Where the records disagree with each other (a route not
// /api/<slice>/<name>, an endpoint handler not pointing at the generated file), generation is refused with what to fix.
//
// A definition's records: its command (description, and the entity whose aggregate is its slice's) or query
// (description, and the read model a slice of reads alone names), its handler (the file the definition is written in,
// and the handler's name), its CLI record (`lathe <slice> <name>`, the tool name), its endpoint (method and route) and
// the endpoint's handler (the identity's name, ending in _IDENTITY, in the generated file).
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { byRecordId } from '../../src/platform/data/ids.ts';
import { GENERATED_HEADER, type Generated } from './output.ts';

type Row = Record<string, unknown>;

/** One command's or query's identity, with where its definition and its identity are written. */
export interface Identity {
  kind: 'command' | 'query';
  id: string;
  slice: { aggregate: string; name: string; dir: string };
  name: string;
  description: string;
  method: 'POST' | 'GET';
  route: string;
  /** The definition's constant, such as ADD_ENTITY, and its identity's, ADD_ENTITY_IDENTITY. */
  constant: string;
  identity: string;
  /** The file the definition is written in, and the file its identity is generated into, from the repo root. */
  file: string;
  generated: string;
  /** Its handler's name: the command's handler function, or the query's run function. */
  handler: string;
}

const SUFFIX = '_IDENTITY';
const snake = (name: string) => name.toUpperCase().replaceAll('-', '_');
const quote = (text: string) => `'${text.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
const relative = (from: string, to: string) => {
  const rel = path.relative(path.dirname(from), to);
  return rel.startsWith('.') ? rel : `./${rel}`;
};

/** A table of Lathe's own data, as rows. */
function table(repo: string, name: string): Row[] {
  const file = path.join(repo, 'data', `${name}.jsonl`);
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as Row);
}

/** Every command and query of Lathe's own slices, from the records; throws with every disagreement among them. */
export function readIdentities(repo: string): Identity[] {
  const problems: string[] = [];
  const index = (rows: Row[], key: string) => {
    const found = new Map<string, Row[]>();
    for (const r of rows) if (typeof r[key] === 'string') found.set(r[key], [...(found.get(r[key]) ?? []), r]);
    return found;
  };
  const one = (rows: Map<string, Row[]>, key: string, what: string, of: string): Row | undefined => {
    const found = rows.get(key) ?? [];
    if (found.length !== 1) problems.push(`${of} has ${found.length} ${what}; it needs exactly one`);
    return found[0];
  };
  const aggregateOf = new Map(table(repo, 'entity').map((e) => [String(e.id), String(e.aggregate_id)]));
  const endpoints = { command: index(table(repo, 'endpoint'), 'command_id'), query: index(table(repo, 'endpoint'), 'query_id') };
  const endpointHandlers = index(table(repo, 'endpoint_handler'), 'endpoint_id');
  const clis = { command: index(table(repo, 'cli_command'), 'command_id'), query: index(table(repo, 'cli_query'), 'query_id') };
  const records = { command: new Map(table(repo, 'command').map((r) => [String(r.id), r])), query: new Map(table(repo, 'query').map((r) => [String(r.id), r])) };

  // The commands and queries of Lathe's slices: those whose handler is a file of a slice's commands/ or its queries.ts.
  const handlers = [
    ...table(repo, 'command_handler').filter((h) => /^lathe\/src\/.+\/commands\/[^/]+\.ts$/.test(String(h.file)) && !String(h.file).endsWith('/index.ts')).map((h) => ({ kind: 'command' as const, h, id: String(h.command_id) })),
    ...table(repo, 'query_handler').filter((h) => /^lathe\/src\/.+\/queries\.ts$/.test(String(h.file))).map((h) => ({ kind: 'query' as const, h, id: String(h.query_id) })),
  ];
  const drafts = handlers.flatMap(({ kind, h, id }) => {
    const record = records[kind].get(id);
    if (!record) return problems.push(`${String(h.id)} handles ${id}, which is no ${kind}`), [];
    const file = String(h.file);
    const dir = kind === 'command' ? path.dirname(path.dirname(file)) : path.dirname(file);
    const generated = kind === 'command' ? `${dir}/commands/identities.generated.ts` : `${dir}/queries.generated.ts`;
    const cli = one(clis[kind], id, `${kind === 'command' ? 'cli_command' : 'cli_query'} records`, id);
    const endpoint = one(endpoints[kind], id, 'endpoints', id);
    const served = endpoint && one(endpointHandlers, String(endpoint.id), 'endpoint handlers', String(endpoint.id));
    if (!cli || !endpoint || !served) return [];
    const named = /^lathe ([a-z][a-z0-9-]*) ([a-z][a-z0-9-]*)$/.exec(String(cli.title));
    if (!named) return problems.push(`${String(cli.id)} is titled ${JSON.stringify(cli.title)}; it is titled lathe <slice> <name>`), [];
    const [, slice, name] = named;
    const method = kind === 'command' ? 'POST' : 'GET';
    const route = `/api/${slice}/${name}`;
    const tool = `${slice}_${name}`.replaceAll('-', '_');
    if (cli.id !== `${id}-CLI`) problems.push(`${String(cli.id)} is the CLI record of ${id}; its ID is ${id}-CLI`);
    if (cli.mcp_tool !== tool) problems.push(`${String(cli.id)} names the tool ${String(cli.mcp_tool)}; lathe ${slice} ${name} is the tool ${tool}`);
    if (endpoint.method !== method || endpoint.route !== route) problems.push(`${String(endpoint.id)} is ${String(endpoint.method)} ${String(endpoint.route)}; ${cli.title} is ${method} ${route}`);
    if (endpoint.title !== `${method} ${route}`) problems.push(`${String(endpoint.id)} is titled ${JSON.stringify(endpoint.title)}; it is titled ${method} ${route}`);
    if (kind === 'query') {
      const expected = id.replace(/QRY(\d+)$/, (_, n: string) => `EP${Number(n) + 400}`);
      if (endpoint.id !== expected) problems.push(`${String(endpoint.id)} exposes ${id}; a query's endpoint takes its number plus 400, ${expected}`);
    }
    if (served.id !== `${String(endpoint.id)}-H`) problems.push(`${String(served.id)} serves ${String(endpoint.id)}; its ID is ${String(endpoint.id)}-H`);
    if (served.file !== generated) problems.push(`${String(served.id)} names the file ${String(served.file)}; the route is generated into ${generated}`);
    const identity = String(served.title);
    if (!/^[A-Z][A-Z0-9_]*_IDENTITY$/.test(identity)) problems.push(`${String(served.id)} is titled ${identity}; it is titled by the definition's constant and ${SUFFIX}, such as ${snake(name)}${SUFFIX}`);
    if (!String(dir).endsWith(`/${slice}`)) problems.push(`${id}'s handler is in ${dir}; lathe ${slice} is the slice in a folder named ${slice}`);
    if (typeof record.description !== 'string' || !record.description.trim()) problems.push(`${id} has no description`);
    return [{
      kind, id, name, method, route, file, generated, identity, constant: identity.slice(0, -SUFFIX.length), handler: String(h.title), description: String(record.description),
      slice: { name: slice, dir, aggregate: kind === 'command' ? (aggregateOf.get(String(record.entity_id)) ?? '') : String(record.read_model_id) },
    } satisfies Identity];
  });

  // A slice names its aggregate (its commands' one), or, holding reads alone, its read model (its queries' one).
  const slices = new Map<string, Identity[]>();
  for (const d of drafts) slices.set(d.slice.dir, [...(slices.get(d.slice.dir) ?? []), d]);
  for (const [dir, own] of slices) {
    const names = new Set(own.map((d) => d.slice.name));
    if (names.size > 1) problems.push(`${dir} holds the slices ${[...names].join(', ')}; a folder holds one`);
    const commands = own.filter((d) => d.kind === 'command');
    const aggregates = new Set((commands.length ? commands : own).map((d) => d.slice.aggregate));
    if (aggregates.size !== 1) problems.push(`${dir}'s ${commands.length ? 'commands change' : 'queries read'} ${[...aggregates].join(', ') || 'nothing'}; a slice's change one aggregate or read one read model`);
    for (const d of own) d.slice.aggregate = [...aggregates][0];
  }
  const constants = index(drafts.map((d) => ({ constant: d.constant, id: d.id })), 'constant');
  for (const [constant, own] of constants) if (own.length > 1) problems.push(`${own.map((d) => String(d.id)).join(', ')} share the constant ${constant}`);
  if (problems.length) throw new Error(`The records of Lathe's commands and queries disagree:\n${problems.map((p) => `- ${p}`).join('\n')}`);
  return drafts.sort(byRecordId);
}

const identityText = (d: Identity) => `export const ${d.identity} = {
  id: ${quote(d.id)},
  slice: { aggregate: ${quote(d.slice.aggregate)}, name: ${quote(d.slice.name)} },
  name: ${quote(d.name)},
  description: ${quote(d.description)},
  method: ${quote(d.method)},
  route: ${quote(d.route)},
} as const;
`;

/** The generated files: each slice's identities and command list, and the registry. */
export function identityFiles(repo: string): Generated {
  const all = readIdentities(repo);
  const files: Generated = new Map();
  const group = <K>(items: Identity[], key: (d: Identity) => K) => {
    const found = new Map<K, Identity[]>();
    for (const d of items) found.set(key(d), [...(found.get(key(d)) ?? []), d]);
    return found;
  };
  for (const [file, own] of group(all, (d) => d.generated)) files.set(file, [GENERATED_HEADER, '', own.map(identityText).join('\n')].join('\n'));

  const commandSlices = [...group(all.filter((d) => d.kind === 'command'), (d) => d.slice.name)].sort(([a], [b]) => a.localeCompare(b));
  for (const [slice, own] of commandSlices) {
    const file = `${own[0].slice.dir}/commands/index.ts`;
    files.set(file, [
      GENERATED_HEADER,
      `import type { AnyCommand } from '${relative(file, 'lathe/src/platform/commands/definition.ts')}';`,
      ...own.map((d) => `import { ${d.constant} } from '${relative(file, d.file)}';`),
      '',
      `export const ${snake(slice)}_COMMANDS = [`,
      ...own.map((d) => `  ${d.constant},`),
      '] as const satisfies readonly AnyCommand[];',
      '',
    ].join('\n'));
  }

  const registry = 'lathe/src/commands.ts';
  const querySlices = [...group(all.filter((d) => d.kind === 'query'), (d) => d.slice.name)].sort(([a], [b]) => a.localeCompare(b));
  files.set(registry, [
    GENERATED_HEADER,
    '// Every command and query, as the CLI (`lathe <slice> <name>`), the MCP server (one tool each) and the HTTP API',
    '// (`POST /api/<slice>/<name>`, or GET for a query) register them.',
    `import type { AnyCommand, AnyQuery, InputsByRoute } from './platform/commands/definition.ts';`,
    ...commandSlices.map(([slice, own]) => `import { ${snake(slice)}_COMMANDS } from '${relative(registry, `${own[0].slice.dir}/commands/index.ts`)}';`),
    ...querySlices.map(([, own]) => `import { ${own.map((d) => d.constant).join(', ')} } from '${relative(registry, own[0].file)}';`),
    '',
    'const COMMANDS = [',
    ...commandSlices.map(([slice]) => `  ...${snake(slice)}_COMMANDS,`),
    '] as const;',
    '',
    'export const ALL_COMMANDS: readonly AnyCommand[] = COMMANDS;',
    '',
    '/** Each command\'s route, with its input: what the app sends, typed by its definition. @public (the app\'s writer) */',
    'export type CommandInputs = InputsByRoute<(typeof COMMANDS)[number]>;',
    '',
    'export const ALL_QUERIES: readonly AnyQuery[] = [',
    ...querySlices.flatMap(([, own]) => own.map((d) => `  ${d.constant},`)),
    '];',
    '',
  ].join('\n'));
  return files;
}

const pascal = (name: string) => name.replace(/(^|-)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase());

/** Adds the names to the file's import from the module, or a new import of them after its last import. */
function withImport(text: string, names: string[], module: string, type = false): string {
  const existing = new RegExp(`^import ${type ? 'type ' : ''}\\{([^}]*)\\} from '${module.replaceAll('.', '\\.')}';$`, 'm').exec(text);
  if (existing) {
    const have = existing[1].split(',').map((n) => n.trim()).filter(Boolean);
    const all = [...have, ...names.filter((n) => !have.includes(n))];
    return text.replace(existing[0], `import ${type ? 'type ' : ''}{ ${all.join(', ')} } from '${module}';`);
  }
  const line = `import ${type ? 'type ' : ''}{ ${names.join(', ')} } from '${module}';\n`;
  const imports = [...text.matchAll(/^import [^;]*;\n/gm)];
  const at = imports.length ? imports.at(-1)!.index + imports.at(-1)![0].length : 0;
  return text.slice(0, at) + line + text.slice(at);
}

/**
 * The definitions not written yet, scaffolded: a command's file with its identity spread and an empty input and a
 * handler that refuses until it is written; a query's definition added to its slice's queries.ts the same way.
 */
export function identityScaffolds(repo: string): Generated {
  const files: Generated = new Map();
  const all = readIdentities(repo);
  const read = (file: string) => files.get(file) ?? (existsSync(path.join(repo, file)) ? readFileSync(path.join(repo, file), 'utf8') : null);
  for (const d of all) {
    const definitions = relative(d.file, 'lathe/src/platform/commands/definition.ts');
    const generated = relative(d.file, d.generated);
    if (d.kind === 'command') {
      if (read(d.file) !== null) continue;
      const type = pascal(d.name);
      files.set(d.file, [
        `import type { CommandDefinition } from '${definitions}';`,
        `import type { Transaction } from '${relative(d.file, 'lathe/src/platform/data/transaction.ts')}';`,
        `import { ${d.identity} } from '${generated}';`,
        '',
        `export type ${type} = Record<string, never>;`,
        '',
        `export const ${d.constant} = {`,
        `  ...${d.identity},`,
        '  input: {},',
        `  handler: ${d.handler},`,
        `} satisfies CommandDefinition<${type}>;`,
        '',
        `export function ${d.handler}(tx: Transaction, _input: ${type}): void {`,
        `  tx.refuse('not-built', ${quote(`${d.slice.name} ${d.name} is not built yet: write its input and handler`)});`,
        '}',
        '',
      ].join('\n'));
      continue;
    }
    let text = read(d.file) ?? '';
    if (new RegExp(`^export const ${d.constant}\\b`, 'm').test(text)) continue;
    text = withImport(text, ['QueryDefinition'], definitions, true);
    text = withImport(text, ['StoreError'], relative(d.file, 'lathe/src/platform/data/problems.ts'));
    text = withImport(text, [d.identity], generated);
    files.set(d.file, `${text.replace(/\n*$/, '\n')}
export function ${d.handler}(_reader: unknown, _input: Record<string, never>): never {
  throw new StoreError([{ rule: 'not-built', message: ${quote(`${d.slice.name} ${d.name} is not built yet: write its input, reader and handler`)} }]);
}

export const ${d.constant}: QueryDefinition<Record<string, never>, never, unknown> = {
  ...${d.identity},
  input: {},
  reader: () => undefined,
  run: ${d.handler},
  text: () => '',
};
`);
  }
  return files;
}
