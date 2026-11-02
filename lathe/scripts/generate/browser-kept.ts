// The app's browser-kept aggregates' repositories and the handlers of their commands that set one setting, generated
// from Lathe's records and each aggregate's model (its model.ts): what the generator's tooling record (LA-MOD-TOOL03)
// generates under app/src. Everything else stays written by hand.
//
// A browser-kept aggregate's model says where it is kept, in its storage setting (<AGGREGATE>_STORAGE: whole under one
// key, or part by part, each under its key in local or session storage or in memory), how it is built from its stored
// form (<aggregate>From, which drops anything malformed for its defaults) and, when its stored form is not the
// aggregate itself, that form (<aggregate>Stored). Its repository loads it whole from those parts, rewrites a part read
// in another form in today's (stale state never lasts) and saves it whole, writing only the parts whose stored text
// changed. A command that sets one setting is named in the model's <AGGREGATE>_SETS with its input's one field and the
// setting's place; its handler loads the aggregate, keeps the value there, holds it to its rules and saves, and the
// same value again saves nothing. Anything else (a fold, a resize brought within limits, a theme copied) is written by
// hand, and the generator refuses what it cannot derive, naming it.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { SchemaDescription } from '../../src/platform/data/schema.ts';
import { GENERATOR } from './aggregates.ts';
import { GENERATED_HEADER, type Generated } from './output.ts';

type Row = Record<string, unknown>;

/** Where generated browser-kept code lives, and the file a slice's generated handlers are written to. */
const APP_SRC = 'app/src/';
const SETS_FILE = 'handlers.generated.ts';

const pascal = (name: string) => name.replace(/(^|[-_])([a-z0-9])/g, (_, __, c: string) => c.toUpperCase());
const camel = (name: string) => pascal(name).replace(/^./, (c) => c.toLowerCase());
const snake = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
/** A path from one generated file to a module, extensionless as the app imports it. */
const relative = (from: string, to: string) => {
  const rel = path.relative(path.dirname(from), to);
  return rel.startsWith('.') ? rel : `./${rel}`;
};
/** A label as a sentence's middle says it: Session settings is session settings, an initialism stays. */
const lower = (label: string) => (/^[A-Z][A-Z]/.test(label) ? label : label.replace(/^./, (c) => c.toLowerCase()));
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

function table(repo: string, name: string): Row[] {
  const file = path.join(repo, 'data', `${name}.jsonl`);
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as Row);
}

/** One part of a stored aggregate: its key and storage, or memory. */
type Part = { name: string; key: string; store: 'local' | 'session' } | { name: string; store: 'memory' };

/** One browser-kept aggregate, as its model says it is kept. */
interface Kept {
  dir: string;
  repository: { id: string; title: string; description: string };
  /** Its name in the model's identifiers (SessionSettings) and the aggregate's own label (Session settings). */
  base: string;
  label: string;
  /** The aggregate's type, the return type of its <aggregate>From. */
  type: string;
  storage: string;
  from: string;
  /** Its <aggregate>Stored, when the stored form is not the aggregate itself. */
  stored: string | null;
  /** Its parts, or null when it is kept whole under one key. */
  parts: Part[] | null;
}

/** An aggregate's model, read for what its repository and set handlers are generated from; throws naming what is missing. */
function readKept(repo: string, record: Row, label: string): Kept {
  const file = String(record.file);
  const dir = path.dirname(file);
  const title = String(record.title);
  const base = title.replace(/Repository$/, '');
  const modelFile = `${dir}/model.ts`;
  const where = `${String(record.id)}'s repository cannot be generated`;
  if (!existsSync(path.join(repo, modelFile))) throw new Error(`${where}: there is no ${modelFile}`);
  const text = readFileSync(path.join(repo, modelFile), 'utf8');
  const storage = `${snake(base)}_STORAGE`;
  const from = `${camel(base)}From`;
  const storedName = `${camel(base)}Stored`;

  let parts: Part[] | null;
  const whole = new RegExp(`^export const ${storage} = \\{ key: '([^']+)', store: '(local|session)' \\} as const satisfies BrowserStorage;$`, 'm').exec(text);
  if (whole) parts = null;
  else {
    const block = new RegExp(`^export const ${storage} = \\{\\n([\\s\\S]*?)^\\} as const satisfies BrowserStorage;$`, 'm').exec(text)?.[1];
    if (block === undefined) throw new Error(`${where}: ${modelFile} exports no ${storage}, one key ({ key, store }) or one part per line, satisfying BrowserStorage`);
    parts = block.split('\n').filter(Boolean).map((line): Part => {
      const kept = /^ {2}(\w+): \{ key: '([^']+)', store: '(local|session)' \},$/.exec(line);
      if (kept) return { name: kept[1], key: kept[2], store: kept[3] as 'local' | 'session' };
      const memory = /^ {2}(\w+): \{ store: 'memory' \},$/.exec(line);
      if (memory) return { name: memory[1], store: 'memory' };
      throw new Error(`${where}: the line ${JSON.stringify(line.trim())} of ${storage} is not one part ({ key, store } or { store: 'memory' })`);
    });
  }
  const type = new RegExp(`^export (?:function ${from}\\([^)]*\\): (\\w+) \\{|const ${from} = \\([^)]*\\): (\\w+) =>)`, 'm').exec(text);
  if (!type) throw new Error(`${where}: ${modelFile} exports no ${from} that names the aggregate's type it returns`);
  const stored = new RegExp(`^export (?:function|const) ${storedName}\\b`, 'm').test(text) ? storedName : null;
  return { dir, repository: { id: String(record.id), title, description: String(record.description ?? '') }, base, label, type: type[1] ?? type[2], storage, from, stored, parts };
}

/** The generated repository: load whole from the stored parts, rewrite one read in another form, save what changed. */
function repositoryText(k: Kept): string {
  const file = `${k.dir}/repository.ts`;
  const instance = camel(k.base);
  const kept = (k.parts ?? []).filter((p) => p.store !== 'memory');
  const memory = (k.parts ?? []).filter((p) => p.store === 'memory');
  const part = (p: Part) => `${k.storage}.${p.name}`;
  const read = k.parts
    ? `{ ${k.parts.map((p) => `${p.name}: ${p.store === 'memory' ? `this.#${p.name}` : `readStored(${part(p)})`}`).join(', ')} }`
    : `readStored(${k.storage})`;
  const value = k.stored ? `${k.stored}(${instance})` : instance;
  const from = k.stored ? 'stored' : instance;
  const put = k.parts
    ? [
        ...(k.stored ? [`    const stored = ${value};`] : []),
        ...kept.map((p) => `    putStored(${part(p)}, ${from}.${p.name}, held);`),
        ...memory.map((p) => `    this.#${p.name} = ${from}.${p.name};`),
      ]
    : [`    putStored(${k.storage}, ${value}, held);`];
  const model = [k.storage, k.from, ...(k.stored ? [k.stored] : [])].sort((x, y) => x.localeCompare(y));
  return [
    GENERATED_HEADER,
    ...commentLines(`${k.repository.title} (${k.repository.id}): ${k.repository.description}`),
    `import { BrowserRepository } from '${relative(file, 'app/src/shell/prefs')}';`,
    `import { putStored, readStored, storedText } from '${relative(file, 'app/src/shell/storage')}';`,
    `import { ${model.join(', ')}, type ${k.type} } from './model';`,
    '',
    `export class ${k.repository.title} extends BrowserRepository<${k.type}> {`,
    ...memory.map((p) => `  #${p.name}: unknown;`),
    ...(memory.length ? [''] : []),
    '  protected stored() {',
    k.parts ? `    return [${kept.map((p) => `storedText(${part(p)})`).join(', ')}].join('\\n');` : `    return storedText(${k.storage}) ?? '';`,
    '  }',
    '',
    `  protected read(): ${k.type} {`,
    `    const ${instance} = ${k.from}(${read});`,
    `    this.#put(${instance}, true);`,
    `    return ${instance};`,
    '  }',
    '',
    `  protected write(${instance}: ${k.type}) {`,
    `    this.#put(${instance}, false);`,
    '  }',
    '',
    '  // Keeps each part whose stored text changed; held, only a part already stored, so one read in another form is',
    '  // rewritten in today\'s.',
    `  #put(${instance}: ${k.type}, held: boolean) {`,
    ...put,
    '  }',
    '}',
    '',
    `export const ${camel(k.repository.title)} = new ${k.repository.title}();`,
    '',
  ].join('\n');
}

/** The model's <AGGREGATE>_SETS: each set command's handler, with its input's one field and the setting's place. */
function readSets(repo: string, k: Kept): Map<string, { field: string; place: string[] }> {
  const modelFile = `${k.dir}/model.ts`;
  const name = `${snake(k.base)}_SETS`;
  const block = new RegExp(`^export const ${name} = \\{\\n([\\s\\S]*?)^\\} as const;$`, 'm').exec(readFileSync(path.join(repo, modelFile), 'utf8'))?.[1];
  if (block === undefined) throw new Error(`${modelFile} exports no ${name}, one set command per line: its set commands' handlers are generated from it`);
  return new Map(block.split('\n').filter(Boolean).map((line) => {
    const m = /^ {2}(\w+): \{ (\w+): '(\w+(?:\.\w+)*)' \},$/.exec(line);
    if (!m) throw new Error(`${modelFile}: the line ${JSON.stringify(line.trim())} of ${name} is not one handler with its field and the setting's place`);
    return [m[1], { field: m[2], place: m[3].split('.') }];
  }));
}

/** One set command's handler: load, the same value saves nothing, keep the value in its place, hold to the rules, save. */
function setText(k: Kept, handler: string, description: string, set: { field: string; place: string[] }): string {
  const repository = camel(k.repository.title);
  const input = pascal(handler);
  const at = (depth: number) => ['was', ...set.place.slice(0, depth)].join('.');
  // The aggregate with the value in its place: each level above it spread, the value set at the last.
  const next = (depth: number): string => {
    const key = set.place[depth];
    const value = depth === set.place.length - 1 ? set.field : next(depth + 1);
    return `{ ...${at(depth)}, ${key === value ? key : `${key}: ${value}`} }`;
  };
  return [
    `export interface ${input} { ${set.field}: ${k.type}${set.place.map((p) => `['${p}']`).join('')} }`,
    '',
    `/** ${description} */`,
    `export function ${handler}({ ${set.field} }: ${input}): void {`,
    `  const was = ${repository}.load();`,
    `  if (${at(set.place.length)} === ${set.field}) return;`,
    `  const next = ${next(0)};`,
    '  holdToRules(next);',
    `  ${repository}.save(next);`,
    '}',
    '',
  ].join('\n');
}

/** Every generated browser-kept repository and each slice's generated set handlers, from what the generator generates under app/src. */
export function browserKeptFiles(repo: string, _schema: SchemaDescription): Generated {
  const generated = new Set(table(repo, 'generates').filter((g) => g.source_id === GENERATOR).map((g) => String(g.target_id)));
  const repositories = table(repo, 'repository').filter((r) => generated.has(String(r.id)) && String(r.file).startsWith(APP_SRC));
  const handlers = table(repo, 'command_handler').filter((h) => generated.has(String(h.id)) && String(h.file).startsWith(APP_SRC));
  const files: Generated = new Map();
  if (!repositories.length && !handlers.length) return files;
  const aggregates = new Map(table(repo, 'aggregate').map((a) => [String(a.id), String(a.title)]));
  const persists = new Map(table(repo, 'persists').map((p) => [String(p.source_id), String(p.target_id)]));
  const commands = new Map(table(repo, 'command').map((c) => [String(c.id), c]));

  const problems: string[] = [];
  const kept = new Map<string, Kept>();
  for (const r of repositories) {
    if (!/^app\/src\/.+\/repository\.ts$/.test(String(r.file))) {
      problems.push(`${GENERATOR} generates ${String(r.id)}, whose file ${String(r.file)} is no aggregate's repository.ts`);
      continue;
    }
    const label = aggregates.get(persists.get(String(r.id)) ?? '');
    if (!label) {
      problems.push(`${String(r.id)} persists no aggregate`);
      continue;
    }
    const k = readKept(repo, r, label);
    kept.set(k.dir, k);
    files.set(String(r.file), repositoryText(k));
  }
  const bySlice = new Map<string, Row[]>();
  for (const h of handlers) {
    const dir = path.dirname(path.dirname(String(h.file)));
    if (path.basename(String(h.file)) !== SETS_FILE || !kept.has(dir)) {
      problems.push(`${GENERATOR} generates ${String(h.id)}, whose file ${String(h.file)} is not the ${SETS_FILE} of an aggregate whose repository it generates`);
      continue;
    }
    bySlice.set(dir, [...(bySlice.get(dir) ?? []), h]);
  }
  if (problems.length) throw new Error(`The records of the app's generated repositories and handlers disagree:\n${problems.map((p) => `- ${p}`).join('\n')}`);

  for (const [dir, own] of bySlice) {
    const k = kept.get(dir)!;
    const sets = readSets(repo, k);
    const titles = new Set(own.map((h) => String(h.title)));
    const unmatched = [...own.filter((h) => !sets.has(String(h.title))).map((h) => `${String(h.id)}'s handler ${String(h.title)} is not in ${snake(k.base)}_SETS`), ...[...sets.keys()].filter((s) => !titles.has(s)).map((s) => `${snake(k.base)}_SETS names ${s}, which no generated command handler is`)];
    if (unmatched.length) throw new Error(`The set handlers of ${dir} cannot be generated:\n${unmatched.map((p) => `- ${p}`).join('\n')}`);
    const file = `${dir}/commands/${SETS_FILE}`;
    const texts = [...own].sort((x, y) => String(x.title).localeCompare(String(y.title))).map((h) => setText(k, String(h.title), String(commands.get(String(h.command_id))?.description ?? ''), sets.get(String(h.title))!));
    files.set(file, [
      GENERATED_HEADER,
      ...commentLines(`The ${lower(k.label)} commands that set one setting, each named in the model's ${snake(k.base)}_SETS: load the ${lower(k.label)}, keep the input's value in its place, hold them to their rules and save; the same value again saves nothing.`),
      `import type { ${k.type} } from '../model';`,
      `import { ${camel(k.repository.title)} } from '../repository';`,
      "import { holdToRules } from '../rules';",
      '',
      texts.join('\n'),
    ].join('\n'));
  }
  return files;
}
