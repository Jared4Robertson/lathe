// The guards that keep the data plumbing from becoming a generic command again, over every aggregate that has a slice:
// only a repository writes data files, only a command handler loads a repository and then only its own aggregate's,
// only the command runner starts a transaction, Lathe's command and rule records match the code one to one, and a
// query reads only its read model.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_COMMANDS, ALL_QUERIES } from '../src/commands.ts';
import { toolName } from '../src/platform/commands/definition.ts';
import { PACKAGE_DIR } from '../src/index.ts';

const SRC = path.join(PACKAGE_DIR, 'src');
const REPO = path.join(PACKAGE_DIR, '..');

/** Every source file, from the repo root, with the files it imports, resolved from the repo root. */
function sources(): { file: string; text: string; imports: string[] }[] {
  const found: { file: string; text: string; imports: string[] }[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.ts')) {
        const text = readFileSync(full, 'utf8');
        const imports = [...text.matchAll(/^import\s[^;]*?from\s+'(\.[^']+)'/gms)].map((m) => path.relative(REPO, path.resolve(dir, m[1])));
        found.push({ file: path.relative(REPO, full), text, imports });
      }
    }
  };
  walk(SRC);
  return found;
}

const isRepository = (file: string) => file.endsWith('/repository.ts');
const isHandler = (file: string) => /\/commands\/[^/]+\.ts$/.test(file) && !file.endsWith('/index.ts') && !file.includes('/platform/');
const sliceOf = (file: string) => path.dirname(file.replace(/\/commands\/[^/]+\.ts$/, '/x.ts'));

/** Lathe's own data, by table. */
const data = (table: string): Record<string, unknown>[] =>
  readFileSync(path.join(REPO, 'data', `${table}.jsonl`), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);

describe('LA-AUT-UC06-R12-T02 only repositories write data files, each handler loads only its own aggregate, and the command records match the code', () => {
  const files = sources();

  it('lets only a repository import data-files.ts, and only command handlers import an aggregate\'s repository', () => {
    const dataFiles = 'lathe/src/platform/data/data-files.ts';
    expect(files.filter((f) => f.imports.includes(dataFiles) && !isRepository(f.file)).map((f) => f.file)).toEqual([]);
    const repositories = files.filter((f) => isRepository(f.file) && !f.file.includes('/platform/')).map((f) => f.file);
    expect(repositories.length).toBeGreaterThan(0);
    const importers = files.filter((f) => f.imports.some((i) => repositories.includes(i)) && !isHandler(f.file) && !isRepository(f.file));
    expect(importers.map((f) => f.file)).toEqual([]);
  });

  it('lets a handler import only its own aggregate\'s repository', () => {
    const crossing = files
      .filter((f) => isHandler(f.file))
      .flatMap((f) => f.imports.filter((i) => isRepository(i) && !i.includes('/platform/') && path.dirname(i) !== sliceOf(f.file)).map((i) => `${f.file} imports ${i}`));
    expect(crossing).toEqual([]);
  });

  it('lets only the command runner start a transaction, and only data-files.ts and the generic write layer change its draft', () => {
    const transact = files.filter((f) => /\.transact\(/.test(f.text)).map((f) => f.file);
    expect(transact).toEqual(['lathe/src/platform/commands/run.ts', 'lathe/src/platform/data/store.ts']);
    const drafting = files.filter((f) => /\b(draftOf|editableTable|rebuildSchema)\b/.test(f.text) && f.file !== 'lathe/src/platform/data/transaction.ts').map((f) => f.file);
    expect(drafting.sort()).toEqual(['lathe/src/platform/data/data-files.ts', 'lathe/src/platform/data/generic-write.ts']);
  });

  it('LA-PAT-AGGREGATE-COMMANDS-R01-T01 LA-STD-PRINCIPLES-R02-T01 matches each command definition to its command, handler, endpoint and CLI records, one to one', () => {
    const handlerFiles = files.filter((f) => isHandler(f.file));
    const commands = new Map(data('command').map((r) => [r.id, r]));
    const handlers = new Map(data('command_handler').map((r) => [r.command_id, r]));
    const endpoints = new Map(data('endpoint').filter((r) => r.command_id).map((r) => [r.command_id, r]));
    const clis = new Map(data('cli_command').map((r) => [r.id, r]));
    const aggregateOf = new Map(data('entity').map((e) => [e.id, e.aggregate_id]));
    for (const definition of ALL_COMMANDS) {
      const own = handlerFiles.filter((f) => f.text.includes(`id: '${definition.id}'`));
      expect(own.map((f) => f.file), definition.id).toHaveLength(1);
      expect(aggregateOf.get(commands.get(definition.id)?.entity_id), definition.id).toBe(definition.slice.aggregate);
      expect(handlers.get(definition.id), definition.id).toMatchObject({ id: `${definition.id}-H`, title: definition.handler.name, file: own[0].file });
      expect(definition.route).toBe(`/api/${definition.slice.name}/${definition.name}`);
      expect(endpoints.get(definition.id), definition.id).toMatchObject({ method: definition.method, route: definition.route });
      expect(clis.get(`${definition.id}-CLI`), definition.id).toMatchObject({ command_id: definition.id, title: `lathe ${definition.slice.name} ${definition.name}`, mcp_tool: toolName(definition) });
    }
    // And back: every handler file defines one command, every handler record in a slice is a definition's, and every
    // command of an aggregate with a slice has its definition.
    for (const f of handlerFiles) expect(f.text.match(/: CommandDefinition</g), f.file).toHaveLength(1);
    const defined = new Set(ALL_COMMANDS.map((d) => d.id));
    const sliced = [...handlers.values()].filter((h) => typeof h.file === 'string' && /\/commands\/[^/]+\.ts$/.test(h.file) && h.file.startsWith('lathe/src/'));
    expect(sliced.filter((h) => !defined.has(String(h.command_id))).map((h) => h.id)).toEqual([]);
    const aggregates = new Set(ALL_COMMANDS.map((d) => d.slice.aggregate));
    // The generic write layer's commands (LA-AUT-CMD01–08, handled in platform/data/store.ts and merge.ts) still sit on
    // the Product aggregate's root until the cutover (step 3) deletes them and this line with them.
    const generic = new Set(['lathe/src/platform/data/store.ts', 'lathe/src/platform/data/merge.ts']);
    const own = (c: Record<string, unknown>) => !generic.has(String(handlers.get(c.id)?.file));
    expect([...commands.values()].filter((c) => aggregates.has(String(aggregateOf.get(c.entity_id))) && !defined.has(String(c.id)) && own(c)).map((c) => c.id)).toEqual([]);
  });

  it('matches each query definition to its query, handler, CLI, endpoint and endpoint handler records, one to one', () => {
    const queries = new Map(data('query').map((r) => [r.id, r]));
    const handlers = new Map(data('query_handler').map((r) => [r.query_id, r]));
    const clis = new Map(data('cli_query').map((r) => [r.id, r]));
    const endpoints = new Map(data('endpoint').filter((r) => r.query_id).map((r) => [r.query_id, r]));
    const endpointHandlers = new Map(data('endpoint_handler').map((r) => [r.endpoint_id, r]));
    for (const definition of ALL_QUERIES) {
      expect(queries.has(definition.id), definition.id).toBe(true);
      expect(handlers.get(definition.id), definition.id).toMatchObject({ title: definition.run.name });
      const file = String(handlers.get(definition.id)!.file);
      const text = readFileSync(path.join(REPO, file), 'utf8');
      expect(text).toContain(`id: '${definition.id}'`);
      expect(clis.get(`${definition.id}-CLI`), definition.id).toMatchObject({ query_id: definition.id, title: `lathe ${definition.slice.name} ${definition.name}`, mcp_tool: toolName(definition) });
      // Its endpoint takes its number plus 400 (166-id-ranges.md), and is served from the route written whole beside it.
      expect(definition.route).toBe(`/api/${definition.slice.name}/${definition.name}`);
      const endpoint = endpoints.get(definition.id);
      expect(endpoint, definition.id).toMatchObject({ id: definition.id.replace(/QRY(\d+)$/, (_, n: string) => `EP${Number(n) + 400}`), method: definition.method, route: definition.route, title: `${definition.method} ${definition.route}` });
      const served = endpointHandlers.get(endpoint!.id);
      expect(served, String(endpoint!.id)).toMatchObject({ id: `${endpoint!.id}-H`, file });
      expect(text, String(served!.id)).toMatch(new RegExp(`export const ${String(served!.title)}: QueryDefinition<[^\\n]*\\n  id: '${definition.id}'`));
    }
    // And back: every query whose handler is an aggregate's queries.ts has its definition, and so does every endpoint of one.
    const defined = new Set(ALL_QUERIES.map((d) => d.id));
    const sliced = [...handlers.values()].filter((h) => typeof h.file === 'string' && h.file.startsWith('lathe/src/') && h.file.endsWith('/queries.ts'));
    expect(sliced.filter((h) => !defined.has(String(h.query_id))).map((h) => h.query_id)).toEqual([]);
    expect([...endpoints.values()].filter((e) => sliced.some((h) => h.query_id === e.query_id) && !defined.has(String(e.query_id))).map((e) => e.id)).toEqual([]);
  });
});

describe('LA-STD-MODELING-R09-T02 each rule record is a rule in its aggregate\'s rules.ts, by the name its refusal carries, and each rule there has its record', () => {
  const files = sources();
  /** The rules a rules.ts writes: each name a refusal of it carries. */
  const rulesIn = (text: string) => new Set([...text.matchAll(/\brule: '([a-z0-9-]+)'/g)].map((m) => m[1]));

  it('names, for each rule record, a rules.ts that writes a rule of its title', () => {
    const records = data('rule');
    expect(records.length).toBeGreaterThan(0);
    const wrong = records.flatMap((r) => {
      const file = files.find((f) => f.file === r.file);
      if (!file || !String(r.file).endsWith('/rules.ts')) return [`${String(r.id)} names ${String(r.file)}, not an aggregate's rules.ts`];
      return rulesIn(file.text).has(String(r.title)) ? [] : [`${String(r.id)}: ${String(r.file)} writes no rule ${String(r.title)}`];
    });
    expect(wrong).toEqual([]);
  });

  it('gives each rule of every aggregate\'s rules.ts its record, with that file', () => {
    const records = data('rule');
    const missing = files
      .filter((f) => f.file.endsWith('/rules.ts'))
      .flatMap((f) => [...rulesIn(f.text)].filter((name) => !records.some((r) => r.title === name && r.file === f.file)).map((name) => `${f.file}: ${name}`));
    expect(missing).toEqual([]);
  });
});

describe('LA-STD-MODELING-R11-T01 a query reads only its read model: no query handler or projection imports a repository or an aggregate\'s model, and a query handler reads only through its own read model\'s reader', () => {
  // The slices whose reads are converted to their own read model and reader: each group adds its own line when its
  // slice is converted, so nothing converted can regress while the rest still convert. The cutover removes this list
  // and the checks then hold for every slice that has a queries.ts.
  const READ_MODEL_SLICES: string[] = [
    'lathe/src/authoring/use-case',
    'lathe/src/authoring/product',
    'lathe/src/authoring/business-outcome',
    'lathe/src/authoring/extension-record',
    'lathe/src/authoring/entry-point',
    'lathe/src/authoring/tooling',
    'lathe/src/authoring/domain',
    'lathe/src/authoring/test-data-set',
    'lathe/src/authoring/pattern',
    'lathe/src/authoring/standard',
    'lathe/src/authoring/specification',
    'lathe/src/authoring/value-object',
    'lathe/src/authoring/read-model',
    'lathe/src/authoring/table',
    'lathe/src/authoring/view',
    'lathe/src/authoring/endpoint',
    'lathe/src/authoring/integration',
    'lathe/src/authoring/ui-component',
    'lathe/src/authoring/storage-requirement',
    'lathe/src/authoring/data-store',
    'lathe/src/checking/check',
    'lathe/src/checking/product-setting',
    'lathe/src/traceability/pattern-following',
  ];
  const files = sources();
  const file = (name: string) => files.find((f) => f.file === name);
  /** The names a file imports from a module, and those it imports as values (not `import type`). */
  const importsFrom = (text: string, module: string) => {
    const found = [...text.matchAll(new RegExp(`^import\\s(type\\s)?([^;]*?)from\\s+'${module.replace('.', '\\.')}'`, 'gms'))];
    const names = (m: RegExpMatchArray) => (m[2].match(/\w+/g) ?? []).filter((n) => n !== 'type');
    return { all: found.flatMap(names), values: found.filter((m) => !m[1]).flatMap((m) => [...m[2].replace(/\btype\s+\w+/g, '').matchAll(/\w+/g)].map((x) => x[0])) };
  };

  it('lets a converted slice\'s queries.ts, read-model.ts and reader.ts import neither its repository nor its model type or row builder', () => {
    const crossing = READ_MODEL_SLICES.flatMap((slice) => {
      const model = file(`${slice}/model.ts`)!;
      // The model's types (the instance type and its parts) and every function over them (the row builders).
      const types = [...model.text.matchAll(/^export interface (\w+)/gm)].map((m) => m[1]);
      const mentions = (signature: string) => types.some((t) => new RegExp(`\\b${t}\\b`).test(signature));
      const builders = [...model.text.matchAll(/^export function (\w+)[^{]*/gm)].filter((m) => mentions(m[0])).map((m) => m[1]);
      const forbidden = new Set([...types, ...builders]);
      return ['queries.ts', 'read-model.ts', 'reader.ts'].flatMap((name) => {
        const reader = file(`${slice}/${name}`);
        if (!reader) return [`${slice}/${name} is missing`];
        return [
          ...(reader.imports.includes(`${slice}/repository.ts`) ? [`${reader.file} imports repository.ts`] : []),
          ...importsFrom(reader.text, './model.ts').all.filter((n) => forbidden.has(n)).map((n) => `${reader.file} imports ${n} from model.ts`),
        ];
      });
    });
    expect(crossing).toEqual([]);
  });

  it('lets a converted slice\'s query handlers read only through its reader, the reader only its read model\'s table, and only the projection the source rows', () => {
    const crossing = READ_MODEL_SLICES.flatMap((slice) => {
      const queries = file(`${slice}/queries.ts`)!;
      const reader = file(`${slice}/reader.ts`)!;
      const readsData = (text: string) => /\.(rows|record)\(/.test(text);
      return [
        // A handler is given its reader: it never sees the data, and takes from the read model only its types.
        ...(readsData(queries.text) || /\bReadView\b/.test(queries.text) ? [`${queries.file} reads the data itself`] : []),
        ...importsFrom(queries.text, './read-model.ts').values.map((n) => `${queries.file} imports ${n} from read-model.ts, not through its reader`),
        ...(readsData(reader.text) ? [`${reader.file} reads the source rows itself`] : []),
        // Each of the slice's queries is given its reader by the runner.
        ...ALL_QUERIES.filter((q) => queries.text.includes(`id: '${q.id}'`) && !q.reader).map((q) => `${q.id} names no reader`),
      ];
    });
    expect(crossing).toEqual([]);
    // Everywhere: a reader is imported only by its own slice's queries.ts.
    const readers = files.filter((f) => f.file.endsWith('/reader.ts')).map((f) => f.file);
    const importers = files.flatMap((f) => f.imports.filter((i) => readers.includes(i) && f.file !== `${path.dirname(i)}/queries.ts`).map((i) => `${f.file} imports ${i}`));
    expect(importers).toEqual([]);
  });

  it('matches each converted read model to its one reader record: its file the slice\'s reader.ts, its title declared there', () => {
    const readers = data('reader');
    for (const slice of READ_MODEL_SLICES) {
      const handlers = data('query_handler').filter((h) => h.file === `${slice}/queries.ts`);
      const readModels = new Set(handlers.map((h) => data('query').find((q) => q.id === h.query_id)?.read_model_id));
      for (const readModel of readModels) {
        const own = readers.filter((r) => r.read_model_id === readModel);
        expect(own, String(readModel)).toHaveLength(1);
        expect(own[0], String(readModel)).toMatchObject({ id: `${String(readModel)}-RD`, file: `${slice}/reader.ts` });
        expect(file(`${slice}/reader.ts`)!.text).toMatch(new RegExp(`^export (interface|class|const|function) ${String(own[0].title)}\\b`, 'm'));
      }
    }
  });
});
