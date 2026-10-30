// LA-PAT-APP-CODE-R21: nothing outlives its purpose. Every class selector in the app's stylesheets is
// used by the app: named literally in app/src (or app/index.html), or built by a known class-building
// helper, a template literal such as `stage-${stage}` whose suffix the source names as a string. A
// failure names the selector, its file and its line, so a removed feature's styles go with it.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const files = walk(path.join(app, 'src'));
const stylesheets = files.filter((f) => f.endsWith('.css'));
/** The app's code with its comments taken out, so a comment that names a class does not keep it. */
const source = [...files.filter((f) => /\.(ts|tsx)$/.test(f)), path.join(app, 'index.html')]
  .map((f) => readFileSync(f, 'utf8'))
  .map((text) => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1'))
  .join('\n');

/** Every token the source names: a literal class is one of them. */
const tokens = new Set(source.match(/[A-Za-z0-9_-]+/g));
/** The string literals the source names: a built class's suffix is one of them, or a number. */
const strings = new Set([...source.matchAll(/(['"`])([A-Za-z0-9_-]+)\1/g)].map((m) => m[2]));
/** The class-building helpers: a template literal that builds a class from a prefix, such as `rel-${style}`. */
const prefixes = [...new Set([...source.matchAll(/(?<![A-Za-z0-9_-])([a-z][a-z0-9-]*-)\$\{/g)].map((m) => m[1]))];

interface Selector { file: string; line: number; name: string }

/** Each class named in a rule's selector, with its line (declarations, comments and at-rule preludes are skipped). */
function classSelectors(file: string): Selector[] {
  const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  const out: Selector[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '}' || ch === ';') start = i + 1;
    if (ch !== '{') continue;
    const prelude = text.slice(start, i);
    start = i + 1;
    if (prelude.trim().startsWith('@')) continue;
    for (const m of prelude.replace(/\[[^\]]*\]/g, (a) => ' '.repeat(a.length)).matchAll(/\.(-?[_a-zA-Z][_a-zA-Z0-9-]*)/g)) {
      const at = start - 1 - prelude.length + (m.index ?? 0);
      out.push({ file: path.relative(app, file), line: text.slice(0, at).split('\n').length, name: m[1] });
    }
  }
  return out;
}

const used = (name: string) =>
  tokens.has(name) ||
  prefixes.some((p) => name.startsWith(p) && name.length > p.length && (strings.has(name.slice(p.length)) || /^\d+$/.test(name.slice(p.length))));

describe('LA-STD-PRINCIPLES-R04-T04 unused CSS', () => {
  it('Every class selector in the app stylesheets is used in app/src', () => {
    const unused = stylesheets.flatMap(classSelectors).filter((s) => !used(s.name));
    const named = new Map<string, string>();
    for (const s of unused) if (!named.has(`${s.file} ${s.name}`)) named.set(`${s.file} ${s.name}`, `${s.file}:${s.line} .${s.name}`);
    expect([...named.values()]).toEqual([]);
  });

  it('finds a selector nothing uses, with its line', () => {
    // The check itself: a class that only a stylesheet names is reported.
    expect(used('a-class-nothing-names')).toBe(false);
    expect(used('graph-page')).toBe(true);
  });
});
