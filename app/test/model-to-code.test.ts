// Exploring's and Platform's app aggregates match their records one to one: each is reached only through its
// repository (its keys named only in its model's storage setting), each slice has one repository with a load and a
// save, a command imports no other slice, each code-bound record names an identifier declared in its file, and each
// command and policy function has its record.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(APP, '..');
const SRC = path.join(APP, 'src');
/** The folders that hold Exploring's and Platform's app slices, one folder per aggregate or read. */
const SLICE_ROOTS = [path.join(SRC, 'exploring'), path.join(SRC, 'platform')];

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? sources(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : []));
const relative = (file: string) => path.relative(REPO, file).split(path.sep).join('/');
const rows = (table: string): Record<string, unknown>[] =>
  readFileSync(path.join(REPO, 'data', `${table}.jsonl`), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l) as Record<string, unknown>);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Whether a file declares the identifier (the part before a dot, for a member such as Appearance.chosen). */
const declares = (text: string, title: string) => {
  const name = title.split('.')[0];
  return new RegExp(`\\b(function|class|interface|type|const|let)\\s+${escape(name)}\\b`).test(text);
};

/** The storage keys each model's storage setting names ('lathe:…' in its file), by key: the models that may name it. */
const keysOf = (models: string[]): Map<string, string[]> => {
  const keys = new Map<string, string[]>();
  for (const file of models) {
    for (const [, key] of readFileSync(file, 'utf8').matchAll(/'(lathe:[^']+)'/g)) keys.set(key, [...new Set([...(keys.get(key) ?? []), relative(file)])]);
  }
  return keys;
};
const CODE_KINDS = ['repository', 'command_handler', 'event_handler', 'query_handler', 'projection', 'reader', 'data_model', 'rule', 'adapter', 'value_type'];

describe('LA-STD-PRINCIPLES-R02-T03 Each app aggregate of Exploring and Platform is reached only through its repository, and its handlers, policies and rules are the records\' one to one', () => {
  const all = sources(SRC);
  const slices = SLICE_ROOTS.flatMap((root) => readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => path.join(root, e.name)));
  const sliceOf = (file: string) => slices.find((s) => file.startsWith(s + path.sep));

  it('lets only an aggregate\'s model name its storage keys, in its storage setting, each key in one model', () => {
    const keys = keysOf(all.filter((f) => path.basename(f) === 'model.ts' && sliceOf(f)));
    expect(keys.size).toBeGreaterThan(0);
    expect([...keys].filter(([, owners]) => owners.length > 1).map(([key, owners]) => `${key} is named by ${owners.join(', ')}`)).toEqual([]);
    const wrong = all.flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      return [...keys].filter(([key, [owner]]) => text.includes(`'${key}'`) && relative(file) !== owner).map(([key]) => `${relative(file)} names ${key}`);
    });
    expect(wrong).toEqual([]);
  });

  it('gives each slice with commands one repository class that loads and saves it whole', () => {
    for (const slice of slices.filter((s) => sources(s).some((f) => f.includes(`${path.sep}commands${path.sep}`)))) {
      const text = readFileSync(path.join(slice, 'repository.ts'), 'utf8');
      const classes = [...text.matchAll(/^export class (\w+Repository) extends BrowserRepository</gm)];
      expect(classes, relative(slice)).toHaveLength(1);
      expect(text, relative(slice)).toMatch(/protected read\(/);
      expect(text, relative(slice)).toMatch(/protected write\(/);
    }
  });

  it('lets a command import only its own slice and the shared code outside the slices', () => {
    const crossing = all
      .filter((f) => f.includes(`${path.sep}commands${path.sep}`) && sliceOf(f))
      .flatMap((file) => [...readFileSync(file, 'utf8').matchAll(/^import\s[^;]*?from\s+'(\.[^']+)'/gms)]
        .map((m) => path.resolve(path.dirname(file), m[1]))
        .filter((target) => { const s = sliceOf(target + '.ts'); return s !== undefined && s !== sliceOf(file); })
        .map((target) => `${relative(file)} imports ${relative(target)}`));
    expect(crossing).toEqual([]);
  });

  it('names in each code-bound record of the slices and the router an identifier declared in its file', () => {
    const inScope = (file: string) => SLICE_ROOTS.some((root) => file.startsWith(relative(root) + '/')) || file === 'app/src/router.tsx';
    const wrong = CODE_KINDS.flatMap((kind) => rows(kind)
      .filter((r) => typeof r.file === 'string' && inScope(r.file))
      .flatMap((r) => {
        const text = readFileSync(path.join(REPO, r.file as string), 'utf8');
        if (kind === 'rule') return text.includes(`rule: '${String(r.title)}'`) ? [] : [`${String(r.id)}: ${String(r.file)} has no rule ${String(r.title)}`];
        return declares(text, String(r.title)) ? [] : [`${String(r.id)}: ${String(r.title)} is not declared in ${String(r.file)}`];
      }));
    expect(wrong).toEqual([]);
  });

  it('gives each command file one handler (a slice\'s generated set handlers several), each named by a command record, and each policy a handler record', () => {
    const handlers = new Set(rows('command_handler').map((r) => `${String(r.file)} ${String(r.title)}`));
    const missing: string[] = [];
    for (const file of all.filter((f) => f.includes(`${path.sep}commands${path.sep}`) && sliceOf(f))) {
      const exported = [...readFileSync(file, 'utf8').matchAll(/^export function (\w+)/gm)].map((m) => m[1]);
      if (path.basename(file) === 'handlers.generated.ts') expect(exported.length, relative(file)).toBeGreaterThan(0);
      else expect(exported, relative(file)).toHaveLength(1);
      for (const name of exported) if (!handlers.has(`${relative(file)} ${name}`)) missing.push(`${relative(file)} ${name}`);
    }
    const reactions = new Set(rows('event_handler').map((r) => `${String(r.file)} ${String(r.title)}`));
    for (const file of all.filter((f) => f.endsWith(`${path.sep}policies.ts`) && sliceOf(f))) {
      for (const [, name] of readFileSync(file, 'utf8').matchAll(/^export function (on\w+)/gm)) if (!reactions.has(`${relative(file)} ${name}`)) missing.push(`${relative(file)} ${name}`);
    }
    expect(missing).toEqual([]);
  });
});
