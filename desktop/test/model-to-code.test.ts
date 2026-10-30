// The desktop's records match its code one to one: each aggregate is reached only through its repository, each
// code-bound record names an identifier declared in its file, and each channel a page sends on has one record.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const DESKTOP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(DESKTOP, '..');
const SRC = path.join(DESKTOP, 'src');

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? sources(path.join(dir, e.name)) : /\.c?ts$/.test(e.name) ? [path.join(dir, e.name)] : []));
const relative = (file: string) => path.relative(REPO, file).split(path.sep).join('/');
const rows = (table: string): Record<string, unknown>[] => {
  try {
    return readFileSync(path.join(REPO, 'data', `${table}.jsonl`), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l) as Record<string, unknown>);
  } catch {
    return [];
  }
};
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Whether a file declares the identifier: a function, class, interface, type, const or let, or a method. */
const declares = (text: string, name: string) =>
  new RegExp(`\\b(function|class|interface|type|const|let)\\s+${escape(name)}\\b`).test(text) || new RegExp(`^\\s+(async\\s+)?${escape(name)}\\s*\\(`, 'm').test(text);

/** The code-bound kinds whose title is an identifier in the record's file. */
const CODE_KINDS = ['repository', 'command_handler', 'event_handler', 'query_handler', 'projection', 'reader', 'data_model', 'adapter', 'predicate', 'service', 'value_type'];
/** The channels the main process takes from pages: ipcMain.on and ipcMain.handle, each with its channel written out. */
const CHANNELS = ['ipc_channel', 'ipc_query'];

describe('LA-STD-PRINCIPLES-R02-T04 Each desktop aggregate is reached only through its repository, and its handlers, policies and channels are the records\' one to one', () => {
  const files = sources(SRC);

  it('lets only a repository read or write the user data folder\'s JSON files', () => {
    const reaching = files.filter((f) => !f.endsWith(`${path.sep}repository.ts`) && /from '(\.\.?\/)+store\.ts'/.test(readFileSync(f, 'utf8')));
    expect(reaching.map(relative)).toEqual([]);
  });

  it('gives each aggregate slice one repository class with a load and a save', () => {
    for (const slice of ['product-window', 'app-server', 'recent-folders', 'shell-settings']) {
      const text = readFileSync(path.join(SRC, slice, 'repository.ts'), 'utf8');
      expect(text.match(/export class \w+Repository\b/g), slice).toHaveLength(1);
      expect(text, slice).toMatch(/^\s+load\(\)/m);
      expect(text, slice).toMatch(/^\s+save\(/m);
    }
  });

  it('lets a command import only its own slice and the shared code outside the slices', () => {
    for (const file of files.filter((f) => f.includes(`${path.sep}commands${path.sep}`))) {
      const slice = path.basename(path.dirname(path.dirname(file)));
      for (const [, spec] of readFileSync(file, 'utf8').matchAll(/from '([^']+)'/g)) {
        if (!spec.startsWith('.')) continue;
        const target = path.relative(SRC, path.resolve(path.dirname(file), spec)).split(path.sep);
        expect(target.length === 1 || target[0] === slice, `${relative(file)} imports ${spec}`).toBe(true);
      }
    }
  });

  it('names in each code-bound record an identifier declared in its desktop file', () => {
    const wrong = CODE_KINDS.flatMap((kind) =>
      rows(kind)
        .filter((r) => typeof r.file === 'string' && r.file.startsWith('desktop/src/'))
        .flatMap((r) => {
          let text: string;
          try {
            text = readFileSync(path.join(REPO, r.file as string), 'utf8');
          } catch {
            return [`${r.id as string}: ${r.file as string} is missing`];
          }
          return declares(text, String(r.title)) ? [] : [`${r.id as string}: ${String(r.title)} is not declared in ${r.file as string}`];
        }),
    );
    expect(wrong).toEqual([]);
  });

  it('gives each command file one handler, named by a command record, and each policy a handler record', () => {
    const handlers = new Map(rows('command_handler').map((r) => [`${r.file as string} ${String(r.title)}`, r.id]));
    for (const file of files.filter((f) => f.includes(`${path.sep}commands${path.sep}`))) {
      const exported = [...readFileSync(file, 'utf8').matchAll(/^export (async )?function (\w+)/gm)].map((m) => m[2]);
      expect(exported, relative(file)).toHaveLength(1);
      expect(handlers.has(`${relative(file)} ${exported[0]}`), `${relative(file)} ${exported[0]} has no command_handler record`).toBe(true);
    }
    const reactions = new Set(rows('event_handler').map((r) => `${r.file as string} ${String(r.title)}`));
    for (const file of files.filter((f) => f.endsWith(`${path.sep}policies.ts`))) {
      for (const [, , name] of readFileSync(file, 'utf8').matchAll(/^export (async )?function (on\w+)/gm)) {
        expect(reactions.has(`${relative(file)} ${name}`), `${relative(file)} ${name} has no event_handler record`).toBe(true);
      }
    }
  });

  it('gives each channel a page sends on exactly one record, and each record its channel', () => {
    const registered = files.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/ipcMain\.(?:on|handle)\('([^']+)'/g)].map((m) => m[1])).sort();
    const recorded = CHANNELS.flatMap((kind) => rows(kind).map((r) => String(r.title))).filter((t) => t.startsWith('lathe:')).sort();
    expect(recorded).toEqual(registered);
    for (const kind of CHANNELS) {
      for (const r of rows(kind)) expect(readFileSync(path.join(REPO, r.file as string), 'utf8'), `${r.id as string}`).toContain(`'${String(r.title)}'`);
    }
  });
});
