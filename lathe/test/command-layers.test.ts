// The guards that keep the data plumbing from becoming a generic command again, over every aggregate that has a slice:
// only a repository writes data files, only a command handler loads a repository and then only its own aggregate's,
// only the command runner starts a transaction, every command of an aggregate with a slice has its definition, Lathe's
// rule records match the code one to one, and a query reads only its read model. Each definition's identity is
// generated from its records (generated.test.ts).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_COMMANDS, ALL_QUERIES } from '../src/commands.ts';
import { toolName } from '../src/platform/commands/definition.ts';
import { PACKAGE_DIR } from '../src/index.ts';
import { useCaseLayerCases } from './use-case-layers.cases.ts';

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

describe('LA-AUT-UC06-R12-T02 only repositories write data files, each handler loads only its own aggregate, and every command has its definition', () => {
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

  it('lets only the command runner start a transaction, and only data-files.ts change its draft', () => {
    const transact = files.filter((f) => /\.transact\(/.test(f.text)).map((f) => f.file);
    expect(transact).toEqual(['lathe/src/platform/commands/run.ts']);
    const drafting = files.filter((f) => /\b(draftOf|editableTable)\b/.test(f.text) && f.file !== 'lathe/src/platform/data/transaction.ts').map((f) => f.file);
    expect(drafting).toEqual(['lathe/src/platform/data/data-files.ts']);
  });

  it('LA-PAT-AGGREGATE-COMMANDS-R01-T01 LA-STD-PRINCIPLES-R02-T01 LA-PAT-CLI-STEPS-R01-T01 reaches each definition by its one CLI command, MCP tool and route, and gives every command of an aggregate with a slice its definition', () => {
    // Each identity is generated from the records (generated.test.ts); here, no two definitions share a name on any interface.
    const all = [...ALL_COMMANDS, ...ALL_QUERIES];
    for (const key of [(d: (typeof all)[number]) => d.id, (d: (typeof all)[number]) => `lathe ${d.slice.name} ${d.name}`, toolName, (d: (typeof all)[number]) => d.route]) {
      const names = all.map(key);
      expect(names.filter((n, at) => names.indexOf(n) !== at)).toEqual([]);
    }
    const defined = new Set(ALL_COMMANDS.map((d) => d.id));
    const aggregateOf = new Map(data('entity').map((e) => [e.id, e.aggregate_id]));
    const aggregates = new Set(ALL_COMMANDS.map((d) => d.slice.aggregate));
    expect(data('command').filter((c) => aggregates.has(String(aggregateOf.get(c.entity_id))) && !defined.has(String(c.id))).map((c) => c.id)).toEqual([]);
  });
});

describe('LA-STD-MODELING-R09-T02 each rule record is a rule in its aggregate\'s rules.ts, by the name its refusal carries, and each rule there has its record', () => {
  /** Every rules.ts under a directory, from the repo root: the app's and the desktop's aggregates keep their rules there too. */
  const rulesFiles = (dir: string): { file: string; text: string; imports: string[] }[] =>
    readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) return rulesFiles(full);
      return name === 'rules.ts' ? [{ file: path.relative(REPO, full), text: readFileSync(full, 'utf8'), imports: [] }] : [];
    });
  const files = [...sources(), ...rulesFiles(path.join(REPO, 'app', 'src')), ...rulesFiles(path.join(REPO, 'desktop', 'src'))];
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
  const files = sources();
  const file = (name: string) => files.find((f) => f.file === name);
  /** Every slice with queries: each folder under lathe/src that has a queries.ts. */
  const SLICES = files.filter((f) => f.file.endsWith('/queries.ts')).map((f) => path.dirname(f.file)).sort();
  /** The names a file imports from a module, and those it imports as values (not `import type`). */
  const importsFrom = (text: string, module: string) => {
    const found = [...text.matchAll(new RegExp(`^import\\s(type\\s)?([^;]*?)from\\s+'${module.replace('.', '\\.')}'`, 'gms'))];
    const names = (m: RegExpMatchArray) => (m[2].match(/\w+/g) ?? []).filter((n) => n !== 'type');
    return { all: found.flatMap(names), values: found.filter((m) => !m[1]).flatMap((m) => [...m[2].replace(/\btype\s+\w+/g, '').matchAll(/\w+/g)].map((x) => x[0])) };
  };

  it('lets a slice\'s queries.ts, read-model.ts and reader.ts import neither its repository nor its model type or row builder', () => {
    const crossing = SLICES.flatMap((slice) => {
      // The model's types (the instance type and its parts) and every function over them (the row builders); none for a
      // slice of reads alone, which has no model.ts.
      const model = file(`${slice}/model.ts`) ?? { text: '' };
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

  it('lets a slice\'s query handlers read only through its reader, the reader only its read model\'s table, and only the projection the source rows', () => {
    const handlerFile = new Map(data('query_handler').map((h) => [h.query_id, h.file]));
    const crossing = SLICES.flatMap((slice) => {
      const queries = file(`${slice}/queries.ts`)!;
      const reader = file(`${slice}/reader.ts`)!;
      const readsData = (text: string) => /\.(rows|record)\(/.test(text);
      return [
        // A handler is given its reader: it never sees the data, and takes from the read model only its types.
        ...(readsData(queries.text) || /\bReadView\b/.test(queries.text) ? [`${queries.file} reads the data itself`] : []),
        ...importsFrom(queries.text, './read-model.ts').values.map((n) => `${queries.file} imports ${n} from read-model.ts, not through its reader`),
        ...(readsData(reader.text) ? [`${reader.file} reads the source rows itself`] : []),
        // Each of the slice's queries is given its reader by the runner.
        ...ALL_QUERIES.filter((q) => handlerFile.get(q.id) === queries.file && !q.reader).map((q) => `${q.id} names no reader`),
      ];
    });
    expect(crossing).toEqual([]);
    // Everywhere: a reader is imported only by its own slice's queries.ts.
    const readers = files.filter((f) => f.file.endsWith('/reader.ts')).map((f) => f.file);
    const importers = files.flatMap((f) => f.imports.filter((i) => readers.includes(i) && f.file !== `${path.dirname(i)}/queries.ts`).map((i) => `${f.file} imports ${i}`));
    expect(importers).toEqual([]);
  });

  it('matches each read model to its one reader record: its file the slice\'s reader.ts, its title declared there', () => {
    const readers = data('reader');
    for (const slice of SLICES) {
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

describe('LA-PAT-AGGREGATE-COMMANDS-R01-T01 the Use case aggregate\'s commands are reached by name from the CLI, the MCP tools and HTTP, and its queries are read by name over HTTP', () => {
  useCaseLayerCases();
});
