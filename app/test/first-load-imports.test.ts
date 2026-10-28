// The wiki's first load leaves out React Flow and ELK (LA-PAT-APP-UX-R11), checked at the
// source: no module that app/src/main.tsx reaches through static imports imports either. The graph,
// the Model view and the theme editor are loaded with import() when first used.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
// Their stylesheet is no JavaScript, and loads first so the app's own styles come after it.
const HEAVY = [/^@xyflow\/react(\/(?!dist\/style\.css$)|$)/, /^elkjs(\/|$)/];

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

describe('the first load', () => {
  it('LA-V61-R37-T05 reaches no React Flow and no ELK through static imports', () => {
    const seen = new Set<string>();
    const found: string[] = [];
    const walk = (file: string, via: string[]) => {
      if (seen.has(file)) return;
      seen.add(file);
      for (const { spec, line } of staticImports(file)) {
        const rel = path.relative(src, file);
        if (HEAVY.some((h) => h.test(spec))) found.push(`app/src/${rel}:${line} imports ${spec} (through ${[...via, rel].join(' -> ')}); load it with import() when first used`);
        const next = resolve(file, spec);
        if (next) walk(next, [...via, rel]);
      }
    };
    walk(path.join(src, 'main.tsx'), []);
    expect(seen.size).toBeGreaterThan(20);
    expect(found).toEqual([]);
  });
});
