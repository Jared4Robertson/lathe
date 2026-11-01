// Each aggregate's repository and the handlers of its pattern commands, generated from Lathe's records, its schema and
// the aggregate's shape (its model.ts's <AGGREGATE>_SHAPE: how each of its kinds sits in an instance). What is generated
// is what the generator's tooling record (LA-AUT-TOOL03, scripts/generate/) generates: a repository (its repository.ts) and a
// command handler (written into its slice's commands/handlers.generated.ts). Everything else stays written by hand.
//
// A repository loads and saves its aggregate whole through the model's <aggregates>From and <aggregate>Rows, and loads
// the instance holding any record of its kinds up the kinds' parents (loadHolding). A pattern command's handler loads
// the instance, adds, changes or removes one record of one kind with the input's columns and lists, holds the
// aggregate to its rules, and saves: an Add of a part pushes it under its parent (or sets it, for a kind held at most
// once), a Change applies the columns given and replaces each list given, a Remove takes the record out with every
// record under it. A kind's rule over its rows (its shape's refusedBy: one each, one per domain) refuses an Add or a
// Change that breaks it before the instance is saved. A command whose input says more
// than its kind's columns and lists (a move, a link with checks, a refusal no rule states) is written by hand, and the
// generator refuses to generate it, naming what it cannot derive.
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { AggregateShape, KindShape } from '../../src/platform/data/repository.ts';
import type { SchemaDescription } from '../../src/platform/data/schema.ts';
import { byRecordId } from '../../src/platform/data/ids.ts';
import { HANDLERS_FILE, readIdentities, type Identity } from './identities.ts';
import { GENERATED_HEADER, type Generated } from './output.ts';

type Row = Record<string, unknown>;

/** The tooling record that generates the repositories and handlers: the generator, scripts/generate/. */
export const GENERATOR = 'LA-AUT-TOOL03';

const quote = (text: string) => `'${text.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
const pascal = (name: string) => name.replace(/(^|[-_])([a-z0-9])/g, (_, __, c: string) => c.toUpperCase());
const camel = (name: string) => pascal(name).replace(/^./, (c) => c.toLowerCase());
const snake = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
const plural = (name: string) => (/[^aeiou]y$/.test(name) ? `${name.slice(0, -1)}ies` : `${name}s`);
/** Words a module may not name a variable: an instance named by one (an interface) takes "the" before it. */
const RESERVED = new Set(['implements', 'interface', 'package', 'private', 'protected', 'public', 'static', 'yield', 'let', 'enum', 'await']);
const variable = (name: string) => (RESERVED.has(name) ? `the${pascal(name)}` : name);
const relative = (from: string, to: string) => {
  const rel = path.relative(path.dirname(from), to);
  return rel.startsWith('.') ? rel : `./${rel}`;
};
/** The text as // comment lines of at most 120 characters. */
function commentLines(text: string): string[] {
  const lines: string[] = [];
  let line = '//';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line.length + word.length + 1 > 120 && line !== '//') {
      lines.push(line);
      line = '//';
    }
    line += ` ${word}`;
  }
  return [...lines, line];
}

/** A label as a sentence's middle says it: Data model is data model, API requirement stays. */
const lower = (label: string) => (/^[A-Z][A-Z]/.test(label) ? label : label.replace(/^./, (c) => c.toLowerCase()));

function table(repo: string, name: string): Row[] {
  const file = path.join(repo, 'data', `${name}.jsonl`);
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as Row);
}

/** One aggregate, as its repository and handlers are generated from it. */
interface Aggregate {
  /** Its folder, such as lathe/src/authoring/aggregate, and its repository's class, such as AggregateRepository. */
  dir: string;
  repository: { id: string; title: string; description: string };
  /** Its model's names: the instance type (Aggregate), its builder (aggregatesFrom), rows (aggregateRows), tables and shape. */
  type: string;
  from: string;
  rows: string;
  tables: string;
  shapeName: string;
  shape: AggregateShape;
  root: string;
  /** Each kind's parent inside the aggregate: its kind and the column naming it; none for the root. */
  parents: Map<string, { kind: string; column: string }>;
  /** Whether its rules.ts holds it to its rules (holdToRules). */
  rules: boolean;
}

/** One field of a command's input, as its definition writes it. */
interface InputField {
  name: string;
  kind: 'column' | 'id' | 'ids' | 'texts' | 'parts' | 'values' | 'links';
  /** For a column, its table and column; for parts, its table. */
  table?: string;
  column?: string;
}

/** A command's input, read from its definition's text: its type's name and its fields in order. */
function readInput(repo: string, d: Identity): { type: string; fields: InputField[] } {
  const text = readFileSync(path.join(repo, d.file), 'utf8');
  const type = new RegExp(`^export const ${d.constant} = \\{[\\s\\S]*?^\\} satisfies CommandDefinition<(\\w+)>;$`, 'm').exec(text)?.[1];
  const block = new RegExp(`^export const ${d.constant} = \\{\\n[\\s\\S]*?^  input: \\{\\n([\\s\\S]*?)^  \\},$`, 'm').exec(text)?.[1];
  if (!type || block === undefined) throw new Error(`${d.file} defines no ${d.constant} with its input, satisfying CommandDefinition<T>: its handler cannot be generated`);
  const fields = block.split('\n').filter(Boolean).map((line): InputField => {
    const m = /^ {4}(\w+): (column|id|ids|texts|parts|values|links)\((.*)\),$/.exec(line);
    if (!m) throw new Error(`${d.file}: the input line ${JSON.stringify(line.trim())} is not one field: its handler cannot be generated`);
    const [, name, kind, args] = m;
    const strings = [...args.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((s) => s[1]);
    if (kind === 'column') return { name, kind, table: strings[0], column: strings[1] };
    if (kind === 'parts') return { name, kind, table: strings[0] };
    return { name, kind: kind as InputField['kind'] };
  });
  return { type, fields };
}

const require = createRequire(import.meta.url);

/** The aggregates whose repository or a handler is generated, by folder, from the records and the models' shapes. */
function readAggregates(repo: string, schema: SchemaDescription, dirs: Set<string>): Map<string, Aggregate> {
  const repositories = table(repo, 'repository');
  const aggregates = new Map<string, Aggregate>();
  for (const dir of dirs) {
    const record = repositories.find((r) => r.file === `${dir}/repository.ts`);
    if (!record) throw new Error(`no repository record names ${dir}/repository.ts: the aggregate's repository and handlers are generated from it`);
    const title = String(record.title);
    const base = title.replace(/Repository$/, '');
    const model = path.join(repo, dir, 'model.ts');
    const shapeName = `${snake(base)}_SHAPE`;
    const shape = (require(model) as Record<string, unknown>)[shapeName] as AggregateShape | undefined;
    if (!shape) throw new Error(`${dir}/model.ts exports no ${shapeName}: the aggregate's shape its repository and handlers are generated from`);
    const kinds = Object.keys(shape);
    const parents = new Map<string, { kind: string; column: string }>();
    for (const kind of kinds.slice(1)) {
      const inside = schema.kinds[kind]?.parents.filter((p) => kinds.includes(p.kind)) ?? [];
      if (inside.length !== 1) throw new Error(`${shapeName}'s ${kind} has ${inside.length} parents among its kinds; each kind but the root has exactly one`);
      parents.set(kind, inside[0]);
    }
    const rulesFile = path.join(repo, dir, 'rules.ts');
    aggregates.set(dir, {
      dir,
      repository: { id: String(record.id), title, description: String(record.description ?? '') },
      type: base,
      from: `${camel(plural(base))}From`,
      rows: `${camel(base)}Rows`,
      tables: `${snake(base)}_TABLES`,
      shapeName,
      shape,
      root: kinds[0],
      parents,
      rules: existsSync(rulesFile) && /^export function holdToRules\(/m.test(readFileSync(rulesFile, 'utf8')),
    });
  }
  return aggregates;
}

/** The instance's expression for a kind's record held as `item`: its row's ID. */
const wraps = (shape: KindShape) => Boolean(shape.lists || shape.given || shape.links);
const idOf = (shape: KindShape, item: string) => (wraps(shape) ? `${item}.row.id` : `${item}.id`);
const rowOf = (shape: KindShape, item: string) => (wraps(shape) ? `${item}.row` : item);

/** The generated repository: load and save whole, and load the instance holding a record of any of its kinds. */
function repositoryText(a: Aggregate, schema: SchemaDescription): string {
  const file = `${a.dir}/repository.ts`;
  const kinds = Object.keys(a.shape);
  const instance = variable(camel(a.type));
  const nested = kinds.length > 1;
  const kindType = `${a.type}Kind`;
  const lines = [
    GENERATED_HEADER,
    ...commentLines(`${a.repository.title} (${a.repository.id}): ${a.repository.description}`),
    `import { AggregateRepository as Repository, type InstanceRows } from '${relative(file, 'lathe/src/platform/data/repository.ts')}';`,
    `import type { Transaction } from '${relative(file, 'lathe/src/platform/data/transaction.ts')}';`,
    `import { ${[a.tables, a.rows, a.from].sort((x, y) => x.localeCompare(y)).join(', ')}, type ${a.type}${nested ? `, type ${kindType}` : ''} } from './model.ts';`,
    '',
    `export class ${a.repository.title} extends Repository<${a.type}> {`,
    '  constructor(tx: Transaction) {',
    `    super(tx, '${a.repository.title}', ${a.tables});`,
    '  }',
    '',
    `  protected read(rootId: string): ${a.type} | undefined {`,
    `    return ${a.from}((table) => this.files.rows(table), rootId)[0];`,
    '  }',
    '',
    `  protected rowsOf(${instance}: ${a.type}): InstanceRows {`,
    `    return ${a.rows}(${instance});`,
    '  }',
  ];
  if (nested) {
    lines.push(
      '',
      `  /** Loads the ${lower(schema.kinds[a.root].label)} that holds the record of the kind with this ID, found up its parents; undefined when there is none. */`,
      `  loadHolding(kind: ${kindType}, id: string): ${a.type} | undefined {`,
      '    const root = this.rootOf(kind, id);',
      `    const ${instance} = root === undefined ? undefined : this.load(root);`,
      `    return ${instance} && holds(${instance}, kind, id) ? ${instance} : undefined;`,
      '  }',
      '',
      '  // The root\'s ID, up the parents of the record of the kind with this ID; undefined when one of them is missing.',
      `  private rootOf(kind: ${kindType}, id: string): string | undefined {`,
      '    const row = this.files.find(kind, { id });',
      '    if (!row) return undefined;',
      '    switch (kind) {',
      ...kinds.map((kind) => {
        const parent = a.parents.get(kind);
        return parent ? `      case '${kind}': return this.rootOf('${parent.kind}', String(row.${parent.column}));` : `      case '${kind}': return id;`;
      }),
      '    }',
      '  }',
      '}',
      '',
      `/** Whether the ${lower(schema.kinds[a.root].label)} holds the record of the kind with this ID. */`,
      `function holds(${instance}: ${a.type}, kind: ${kindType}, id: string): boolean {`,
      '  switch (kind) {',
      ...kinds.map((kind, at) => {
        const s = a.shape[kind];
        if (at === 0) return `    case '${kind}': return ${instance}.root === id;`;
        if (s.one) return `    case '${kind}': return ${instance}.${s.at}?.${wraps(s) ? 'row.' : ''}id === id;`;
        return `    case '${kind}': return ${instance}.${s.at}.some((x) => ${idOf(s, 'x')} === id);`;
      }),
      '  }',
      '}',
      '',
    );
  } else lines.push('}', '');
  return lines.join('\n');
}

/** What a command does to its kind, from its title: Add a data model, Change a rule, Remove an entity. */
const VERBS = { Add: 'add', Change: 'change', Remove: 'remove' } as const;

/** One handler's function, written for its command, its kind and its aggregate; throws with what it cannot derive. */
function handlerText(a: Aggregate, schema: SchemaDescription, d: Identity, kind: string, verb: 'add' | 'change' | 'remove', input: { type: string; fields: InputField[] }): string {
  const shape = a.shape[kind];
  if (!shape) throw new Error(`${d.id}'s handler cannot be generated: ${a.shapeName} holds no ${kind}. Write it by hand, in ${d.file}`);
  const instance = variable(camel(a.type));
  const repository = plural(camel(a.type));
  const label = (k: string) => lower(schema.kinds[k]?.label ?? k);
  const isRoot = kind === a.root;
  const parent = a.parents.get(kind);
  // What the record holds beside its row: its lists (links and parts, each a list) and its single links (one ID or null).
  const members = [
    ...Object.entries(shape.lists ?? {}).map(([field, prop]) => ({ field, prop, single: false, given: false })),
    ...Object.entries(shape.given ?? {}).map(([field, prop]) => ({ field, prop, single: false, given: true })),
    ...Object.entries(shape.links ?? {}).map(([field, prop]) => ({ field, prop, single: true, given: false })),
  ];
  const columns = input.fields.filter((f) => f.kind === 'column');
  const given = new Map(input.fields.filter((f) => f.kind !== 'column').map((f) => [f.name, f]));
  const problems = [
    ...columns.filter((f) => f.table !== kind).map((f) => `its field ${f.name} is a column of ${f.table}, not of ${kind}`),
    ...[...given.values()].flatMap((f) => {
      const member = members.find((m) => m.field === f.name);
      if (!member) return [`its field ${f.name} is none of ${a.shapeName}.${kind}'s lists or links`];
      if (member.single !== (f.kind === 'id') || !['id', 'ids', 'texts', 'parts'].includes(f.kind)) return [`its field ${f.name} is ${f.kind === 'id' ? 'one ID' : `a ${f.kind} field`}, not what ${a.shapeName}.${kind} holds`];
      return [];
    }),
    ...(columns.some((f) => f.column === 'id') ? [] : ['it names no ID']),
    ...(verb === 'remove' && input.fields.length !== 1 ? ['a Remove takes the ID alone'] : []),
    ...(verb === 'add' && !isRoot && !columns.some((f) => f.column === parent?.column) ? [`it names no ${parent?.column}`] : []),
    ...(verb === 'add' && shape.one && !shape.refusedBy ? [`an Add of a kind held at most once refuses a second one: name the rule that does in ${a.shapeName}.${kind}.refusedBy`] : []),
  ];
  if (problems.length) throw new Error(`${d.id}'s handler cannot be generated: ${problems.join('; ')}. Write it by hand, in ${d.file}`);

  // A part's rows, numbered under their record when the part table has positions.
  const partRows = (f: InputField, value: string, owner: string) => {
    const part = schema.tables[f.table!];
    const ownerColumn = part?.ownerColumn;
    if (!ownerColumn) throw new Error(`${d.id}'s handler cannot be generated: its ${f.name} is a list of ${f.table}, which has no owner column. Write it by hand, in ${d.file}`);
    const position = part.columns.some((c) => c.name === 'position');
    return `${value}.map((item${position ? ', at' : ''}) => ({ ${ownerColumn}: ${owner}${position ? ', position: at + 1' : ''}, ...item }))`;
  };
  // A member's value in a new record, and in a changed one (where `held` is what it holds now).
  const added = (m: (typeof members)[number], owner: string) => {
    const f = given.get(m.field);
    if (!f) return m.single ? 'null' : '[]';
    if (m.single) return `${m.field} ?? null`;
    return f.kind === 'parts' && !m.given ? partRows(f, m.field, owner) : m.field;
  };
  const kept = (m: (typeof members)[number], held: string) => {
    const f = given.get(m.field);
    if (!f) return held;
    if (m.single) return `input.${m.field} === undefined ? ${held} : input.${m.field}`;
    return f.kind === 'parts' && !m.given ? `input.${m.field} ? ${partRows(f, `input.${m.field}`, 'input.id')} : ${held}` : `input.${m.field} ?? ${held}`;
  };
  const wrapped = members.length > 0;
  const changedColumns = columns.filter((f) => f.column !== 'id' && f.column !== parent?.column).map((f) => quote(f.column!));
  const applied = (row: string) => (changedColumns.length ? `changed(${row}, input, [${changedColumns.join(', ')}])` : row);
  const loading = (k: string, id: string) => {
    const load = k === a.root ? `${repository}.load(${id})` : `${repository}.loadHolding('${k}', ${id})`;
    return `  const ${instance} = ${load} ?? tx.refuse('missing', \`there is no ${label(k)} \${${id}}\`);`;
  };
  const body: string[] = [`  const ${repository} = new ${a.repository.title}(tx);`];
  const hold = () => (a.rules ? [`  holdToRules(tx, ${instance});`] : []);
  // The kind's rule over its rows as they would be saved, when its shape names one.
  const refuseBroken = (rows: string) => (shape.refusedBy ? [`  refuseBroken(${shape.refusedBy}(${rows}));`] : []);
  const listRows = `${instance}.${shape.at}.map((x) => ${rowOf(shape, 'x')})`;

  if (verb === 'add') {
    const destructure = given.size ? `  const { ${[...given.values()].map((f) => (f.kind === 'id' ? f.name : `${f.name} = []`)).join(', ')}, ...row } = input;` : null;
    const row = given.size ? 'row' : 'input';
    if (isRoot) {
      if (destructure) body.push(destructure);
      const under = Object.values(a.shape).slice(1).map((s) => `${s.at}: ${s.one ? 'null' : '[]'}`);
      body.push(`  const ${instance} = ${repository}.create({ ${[`root: ${row}.id`, `${shape.at}: ${row}`, ...members.map((m) => `${m.prop}: ${added(m, `${row}.id`)}`), ...under].join(', ')} });`);
    } else {
      body.push(loading(parent!.kind, `input.${parent!.column}`));
      if (destructure) body.push(destructure);
      const item = wrapped ? `{ ${['row', ...members.map((m) => `${m.prop}: ${added(m, 'row.id')}`)].join(', ')} }` : row;
      if (shape.one) {
        const held = `${instance}.${shape.at}`;
        body.push(...refuseBroken(`[...(${held} ? [${rowOf(shape, held)}] : []), ${row}]`), `  ${held} = ${item};`);
      } else body.push(`  ${instance}.${shape.at}.push(${item});`, ...refuseBroken(listRows));
    }
    body.push(...hold(), `  ${repository}.save(${instance});`);
  } else if (verb === 'change') {
    const changes = (item: string) => (wrapped ? `{ ${[`row: ${applied(`${item}.row`)}`, ...members.map((m) => `${m.prop}: ${kept(m, `${item}.${m.prop}`)}`)].join(', ')} }` : applied(item));
    body.push(loading(kind, 'input.id'));
    if (isRoot) {
      if (changedColumns.length) body.push(`  ${instance}.${shape.at} = ${applied(`${instance}.${shape.at}`)};`);
      for (const m of members) if (given.has(m.field)) body.push(`  ${instance}.${m.prop} = ${kept(m, `${instance}.${m.prop}`)};`);
    } else if (shape.one) {
      body.push(`  const held = ${instance}.${shape.at}!;`, `  ${instance}.${shape.at} = ${changes('held')};`);
    } else {
      body.push(`  ${instance}.${shape.at} = ${instance}.${shape.at}.map((x) => (${idOf(shape, 'x')} === input.id ? ${changes('x')} : x));`, ...refuseBroken(listRows));
    }
    body.push(...hold(), `  ${repository}.save(${instance});`);
  } else {
    body.push(loading(kind, 'input.id'));
    if (isRoot) body.push(`  ${repository}.remove(${instance});`);
    else {
      body.push(shape.one ? `  ${instance}.${shape.at} = null;` : `  ${instance}.${shape.at} = ${instance}.${shape.at}.filter((x) => ${idOf(shape, 'x')} !== input.id);`);
      // Every record under it goes with it: its children, then theirs.
      const under = (k: string, ids: string | null): string[] => Object.keys(a.shape).filter((c) => a.parents.get(c)?.kind === k).flatMap((c) => {
        const s = a.shape[c];
        const col = `${rowOf(s, 'x')}.${a.parents.get(c)!.column}`;
        const grand = Object.keys(a.shape).some((g) => a.parents.get(g)?.kind === c);
        if (s.one) {
          if (grand) throw new Error(`${d.id}'s handler cannot be generated: under a ${kind}, ${c} is held at most once and has records under it. Write it by hand, in ${d.file}`);
          const at = `${instance}.${s.at}`;
          return [`  if (${at} && ${ids ? `${ids}.has(${rowOf(s, at)}.${a.parents.get(c)!.column})` : `${rowOf(s, at)}.${a.parents.get(c)!.column} === input.id`}) ${at} = null;`];
        }
        const set = `${camel(c)}Ids`;
        const [goes, stays] = ids ? [`${ids}.has(${col})`, `!${ids}.has(${col})`] : [`${col} === input.id`, `${col} !== input.id`];
        return [
          ...(grand ? [`  const ${set} = new Set(${instance}.${s.at}.filter((x) => ${goes}).map((x) => ${idOf(s, 'x')}));`] : []),
          `  ${instance}.${s.at} = ${instance}.${s.at}.filter((x) => ${stays});`,
          ...(grand ? under(c, set) : []),
        ];
      });
      body.push(...under(kind, null), `  ${repository}.save(${instance});`);
    }
  }
  return [`/** ${String(d.description)} */`, `export function ${d.handler}(tx: Transaction, input: ${input.type}): void {`, ...body, '}', ''].join('\n');
}

/** Every generated repository and each slice's generated handlers, from what the generator's tooling record generates. */
export function aggregateFiles(repo: string, schema: SchemaDescription): Generated {
  const generated = new Set(table(repo, 'generates').filter((g) => g.source_id === GENERATOR).map((g) => String(g.target_id)));
  const repositories = table(repo, 'repository').filter((r) => generated.has(String(r.id)));
  const handlers = table(repo, 'command_handler').filter((h) => generated.has(String(h.id)));
  if (!repositories.length && !handlers.length) return new Map();
  const identities = new Map(readIdentities(repo).map((d) => [d.id, d]));
  const commands = new Map(table(repo, 'command').map((c) => [String(c.id), c]));
  const tableOf = new Map(table(repo, 'table').filter((t) => typeof t.entity_id === 'string').map((t) => [String(t.entity_id), String(t.name)]));

  const problems: string[] = [];
  for (const r of repositories) if (!/^lathe\/src\/.+\/repository\.ts$/.test(String(r.file))) problems.push(`${GENERATOR} generates ${String(r.id)}, whose file ${String(r.file)} is no aggregate's repository.ts`);
  const drafts = handlers.flatMap((h) => {
    const d = identities.get(String(h.command_id));
    if (!d) return problems.push(`${String(h.id)} handles ${String(h.command_id)}, which is no command of a slice`), [];
    const expected = `${d.slice.dir}/commands/${HANDLERS_FILE}`;
    if (h.file !== expected) return problems.push(`${GENERATOR} generates ${String(h.id)}, whose file is ${String(h.file)}; a generated handler is in ${expected}`), [];
    return [d];
  });
  if (problems.length) throw new Error(`The records of Lathe's generated repositories and handlers disagree:\n${problems.map((p) => `- ${p}`).join('\n')}`);

  const dirs = new Set([...repositories.map((r) => path.dirname(String(r.file))), ...drafts.map((d) => d.slice.dir)]);
  const aggregates = readAggregates(repo, schema, dirs);
  const files: Generated = new Map();
  for (const r of repositories) {
    const a = aggregates.get(path.dirname(String(r.file)))!;
    files.set(String(r.file), repositoryText(a, schema));
  }
  const bySlice = new Map<string, Identity[]>();
  for (const d of drafts.sort(byRecordId)) bySlice.set(d.slice.dir, [...(bySlice.get(d.slice.dir) ?? []), d]);
  for (const [dir, own] of bySlice) {
    const a = aggregates.get(dir)!;
    const file = `${dir}/commands/${HANDLERS_FILE}`;
    const inputs = new Map(own.map((d) => [d.id, readInput(repo, d)]));
    const texts = own.map((d) => {
      const command = commands.get(d.id)!;
      const verb = VERBS[String(command.title).split(' ')[0] as keyof typeof VERBS];
      const kind = tableOf.get(String(command.entity_id));
      if (!verb || !kind) throw new Error(`${d.id}'s handler cannot be generated: it is titled ${JSON.stringify(command.title)} (an Add, Change or Remove) and its entity ${String(command.entity_id)} has ${kind ? 'the table ' + kind : 'no table'}. Write it by hand, in ${d.file}`);
      return handlerText(a, schema, d, kind, verb, inputs.get(d.id)!);
    });
    const body = texts.join('\n');
    // What the handlers take from the aggregate's rules.ts: holdToRules and the kinds' rules they refuse with.
    const refusers = Object.values(a.shape).flatMap((s) => (s.refusedBy ? [s.refusedBy] : []));
    const rules = [...new Set(['holdToRules', ...refusers])].filter((name) => body.includes(`${name}(`)).sort((x, y) => x.localeCompare(y));
    const types = own.map((d) => ({ type: inputs.get(d.id)!.type, from: relative(file, d.file) }));
    files.set(file, [
      GENERATED_HEADER,
      `// The ${own[0].slice.name} commands whose handler is the pattern: load the ${lower(schema.kinds[a.root]?.label ?? a.type)}, add, change or remove one record with the`,
      '// input\'s columns and lists, hold it to its rules, and save. Each definition takes its handler from here.',
      ...(body.includes('changed(') ? [`import { changed } from '${relative(file, 'lathe/src/platform/data/rows.ts')}';`] : []),
      ...(body.includes('refuseBroken(') ? [`import { refuseBroken } from '${relative(file, 'lathe/src/platform/data/rules.ts')}';`] : []),
      `import type { Transaction } from '${relative(file, 'lathe/src/platform/data/transaction.ts')}';`,
      `import { ${a.repository.title} } from '../repository.ts';`,
      ...(rules.length ? [`import { ${rules.join(', ')} } from '../rules.ts';`] : []),
      ...types.map((t) => `import type { ${t.type} } from '${t.from}';`),
      '',
      body,
    ].join('\n'));
  }
  return files;
}
