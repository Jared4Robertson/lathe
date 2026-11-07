// The wiki's first load leaves out what a record page doesn't need (LA-V61-R37, within LA-PAT-APP-UX-R11's budget), checked at the
// source: no module that app/src/main.tsx reaches through static imports imports it. ELK: the graph,
// the ERD view and the theme editor are loaded with import() when first used. The chat panel: the desktop's alone
// (LA-PLT-UC19), loaded with import() when the chat first shows, so a browser never fetches it.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const HEAVY = [/^elkjs(\/|$)/];

/** The static imports of a module (not `import type`, not `import()`), with the line each is on. */
function staticImports(file: string): { spec: string; line: number }[] {
  const text = readFileSync(file, 'utf8');
  const out: { spec: string; line: number }[] = [];
  const re = /^\s*import\s+(?!type\s)(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/gm;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    out.push({ spec: m[1], line: text.slice(0, m.index).split('\n').length + (m[0].startsWith('\n') ? 1 : 0) });
  }
  return out;
}

function resolve(from: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(from), spec);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
    if (existsSync(candidate) && /\.(ts|tsx)$/.test(candidate)) return candidate;
  }
  return null;
}

/** Every static import that main.tsx reaches, with the file it resolves to (null for a package) and the path to it. */
function firstLoad(): { file: string; spec: string; line: number; next: string | null; via: string[] }[] {
  const seen = new Set<string>();
  const out: { file: string; spec: string; line: number; next: string | null; via: string[] }[] = [];
  const walk = (file: string, via: string[]) => {
    if (seen.has(file)) return;
    seen.add(file);
    const rel = path.relative(src, file);
    for (const { spec, line } of staticImports(file)) {
      const next = resolve(file, spec);
      out.push({ file: rel, spec, line, next, via: [...via, rel] });
      if (next) walk(next, [...via, rel]);
    }
  };
  walk(path.join(src, 'main.tsx'), []);
  expect(seen.size).toBeGreaterThan(20);
  return out;
}

const where = (i: { file: string; spec: string; line: number; via: string[] }) => `app/src/${i.file}:${i.line} imports ${i.spec} (through ${i.via.join(' -> ')}); load it with import() when first used`;

describe('the first load', () => {
  it('LA-V61-R37-T05 reaches no ELK through static imports', () => {
    expect(firstLoad().filter((i) => HEAVY.some((h) => h.test(i.spec))).map(where)).toEqual([]);
  });

  it('LA-V61-R37-T06 reaches no chat panel through static imports', () => {
    const panel = path.join(src, 'chat', 'ChatPanel.tsx');
    expect(existsSync(panel)).toBe(true);
    expect(firstLoad().filter((i) => i.next === panel).map(where)).toEqual([]);
  });
});
