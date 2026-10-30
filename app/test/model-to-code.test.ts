// Exploring's and Platform's app aggregates match their records one to one: each is reached only through its
// repository, each slice has one repository with a load and a save, a command imports no other slice, each code-bound
// record names an identifier declared in its file, and each command and policy function has its record.
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

/** The storage keys of the aggregates, each with the one repository that may name it. */
const KEYS: Record<string, string> = {
  'lathe:space': 'app/src/exploring/space/repository.ts',
  'lathe:space-pages': 'app/src/exploring/space/repository.ts',
  'lathe:space-rail': 'app/src/exploring/space/repository.ts',
  'lathe:nav-folders': 'app/src/exploring/nav-row/repository.ts',
  'lathe:nav-sections': 'app/src/exploring/nav-row/repository.ts',
  'lathe:tabs': 'app/src/exploring/tab-set/repository.ts',
  'lathe:place': 'app/src/exploring/tab-set/repository.ts',
  'lathe:stage': 'app/src/exploring/tab-set/repository.ts',
  'lathe:session-settings': 'app/src/exploring/session-settings/repository.ts',
  'lathe:nav-width': 'app/src/platform/panel/repository.ts',
  'lathe:nav-collapsed': 'app/src/platform/panel/repository.ts',
  'lathe:themes': 'app/src/platform/appearance/repository.ts',
  'lathe:theme': 'app/src/platform/appearance/repository.ts',
  'lathe:color-mode': 'app/src/platform/appearance/repository.ts',
  'lathe:scroll-to-zoom': 'app/src/platform/appearance/repository.ts',
  'lathe:theme-css': 'app/src/platform/appearance/repository.ts',
  'lathe:keybindings': 'app/src/platform/key-bindings/repository.ts',
};
const CODE_KINDS = ['repository', 'command_handler', 'event_handler', 'query_handler', 'projection', 'reader', 'data_model', 'rule', 'adapter', 'value_type'];

describe('LA-STD-PRINCIPLES-R02-T03 Each app aggregate of Exploring and Platform is reached only through its repository, and its handlers, policies and rules are the records\' one to one', () => {
  const all = sources(SRC);
  const slices = SLICE_ROOTS.flatMap((root) => readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => path.join(root, e.name)));
  const sliceOf = (file: string) => slices.find((s) => file.startsWith(s + path.sep));

  it('lets only an aggregate\'s repository name its storage keys', () => {
    const wrong = all.flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      return Object.entries(KEYS).filter(([key, owner]) => text.includes(`'${key}'`) && relative(file) !== owner).map(([key]) => `${relative(file)} names ${key}`);
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

  it('gives each command file one handler, named by a command record, and each policy a handler record', () => {
    const handlers = new Set(rows('command_handler').map((r) => `${String(r.file)} ${String(r.title)}`));
    const missing: string[] = [];
    for (const file of all.filter((f) => f.includes(`${path.sep}commands${path.sep}`) && sliceOf(f))) {
      const exported = [...readFileSync(file, 'utf8').matchAll(/^export function (\w+)/gm)].map((m) => m[1]);
      expect(exported, relative(file)).toHaveLength(1);
      if (!handlers.has(`${relative(file)} ${exported[0]}`)) missing.push(`${relative(file)} ${exported[0]}`);
    }
    const reactions = new Set(rows('event_handler').map((r) => `${String(r.file)} ${String(r.title)}`));
    for (const file of all.filter((f) => f.endsWith(`${path.sep}policies.ts`) && sliceOf(f))) {
      for (const [, name] of readFileSync(file, 'utf8').matchAll(/^export function (on\w+)/gm)) if (!reactions.has(`${relative(file)} ${name}`)) missing.push(`${relative(file)} ${name}`);
    }
    expect(missing).toEqual([]);
  });
});
