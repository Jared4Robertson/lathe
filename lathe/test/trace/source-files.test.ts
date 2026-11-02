// Every source file traced to a technical record (LA-TRC-DS03, code-file-untraced): which files count as source, and
// which a record's file or folder traces.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULT_SOURCE, DEFAULT_TESTS, loadConfig, loadWorkspace, SCHEMA_VERSION, type Workspace } from '../../src/index.ts';
import { isTraced, sourceFiles } from '../../src/trace/source-files.ts';
import { build, loadData, removeData, writeData } from '../helpers.ts';

afterAll(removeData);

function write(root: string, files: Record<string, string>) {
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), text);
  }
}

/** Beside the source files: a test, a test helper, configs, a generated file, build output and another product. */
const LEFT_OUT = {
  'src/loans.test.ts': "it('x');\n",
  'test/helpers.ts': 'export {};\n',
  'src/__tests__/fixture.ts': 'export {};\n',
  'vite.config.ts': 'export default {};\n',
  '.eslintrc.cjs': 'module.exports = {};\n',
  'src/env.d.ts': 'declare const x: number;\n',
  'src/rows.ts': '// Generated from the schema; do not edit by hand.\nexport {};\n',
  'src/parser.ts': '/* @generated */\nexport {};\n',
  'dist/index.js': 'export {};\n',
  'node_modules/pkg/index.js': 'export {};\n',
  '.cache/x.js': 'export {};\n',
  'examples/other/lathe.config.json': '{}\n',
  'examples/other/src/code.ts': 'export {};\n',
  'README.md': '# Notes\n',
};

const untraced = (ws: Workspace) =>
  ws.coverage.flatMap((c) => c.gaps.filter((g) => g.missing === 'code-file-untraced').map((g) => ({ product: c.product, domain: c.domain, id: g.id, kind: g.kind })));

describe('source file tracing', () => {
  it('LA-TRC-DS03-T01 source files leave out tests, configs, generated files and build output, and a named folder traces what it holds', async () => {
    const root = writeData({});
    write(root, { ...LEFT_OUT, 'src/loans.ts': '', 'src/lending/rules.ts': '', 'scripts/build.py': '', 'app/view.tsx': '' });
    const files = await sourceFiles(root, DEFAULT_SOURCE, DEFAULT_TESTS);
    expect(files).toEqual(['app/view.tsx', 'scripts/build.py', 'src/lending/rules.ts', 'src/loans.ts']);
    // Narrower globs read only what they match.
    expect(await sourceFiles(root, ['src/**/*.ts'], DEFAULT_TESTS)).toEqual(['src/lending/rules.ts', 'src/loans.ts']);
    // A file named in the test globs is a test, whatever its name.
    expect(await sourceFiles(root, ['src/**/*.ts'], [...DEFAULT_TESTS, 'src/lending/**'])).toEqual(['src/loans.ts']);
    // A record traces its file, and every file in a folder it names, written as records write paths.
    const named = new Set(['src/lending', 'app/view.tsx']);
    expect(isTraced('src/lending/rules.ts', named)).toBe(true);
    expect(isTraced('app/view.tsx', named)).toBe(true);
    expect(isTraced('src/loans.ts', named)).toBe(false);
    expect(isTraced('src/lending-old.ts', named)).toBe(false);
    expect(isTraced('src/loans.ts', new Set(['.']))).toBe(true);
  });

  it('LA-TRC-UC02-R12-T01 a source file no technical record names is a gap; tests, configs, generated files and build output are left out', async () => {
    const data = {
      product: [{ id: 'EX', title: 'Example', description: 'A small library that lends tools.' }],
      domain: [{ id: 'EX-LEND', title: 'Lending', product_id: 'EX', position: 1, subdomain_type: 'core', description: 'Lending tools to members.' }],
      aggregate: [{ id: 'EX-LEND-A1', title: 'Loan', domain_id: 'EX-LEND', identity: 'Loan ID', description: 'One tool lent to one member.' }],
      entity: [{ id: 'EX-LEND-EN01', title: 'Loan', aggregate_id: 'EX-LEND-A1', role: 'root', description: 'The loan itself.' }],
      repository: [{ id: 'EX-LEND-REPO01', title: 'Loans', domain_id: 'EX-LEND', file: 'src/lending', description: 'Keeps loans in the loans table.' }],
      persists: [{ source_id: 'EX-LEND-REPO01', target_id: 'EX-LEND-A1' }],
      command: [{ id: 'EX-LEND-CMD01', title: 'Open a loan', entity_id: 'EX-LEND-EN01', description: 'Lends a free tool to a member.' }],
      command_handler: [{ id: 'EX-LEND-CMD01-H', title: 'openLoan', command_id: 'EX-LEND-CMD01', file: './src/open.ts', description: 'Saves the loan in one transaction.' }],
    };
    const root = await build(data, { missing: ['src/lending'], files: { ...LEFT_OUT, 'src/lending/store.ts': '', 'src/helpers.ts': '', 'scripts/seed.js': '' } });
    const ws = await loadWorkspace(root);
    // Only the source files nothing names, under the product outside every domain; code needs no record IDs.
    expect(untraced(ws)).toEqual([
      { product: 'EX', domain: null, id: 'scripts/seed.js', kind: 'file' },
      { product: 'EX', domain: null, id: 'src/helpers.ts', kind: 'file' },
    ]);
    expect(ws.coverage.find((c) => c.domain === null)?.gaps.find((g) => g.id === 'src/helpers.ts')?.message).toBe(
      'Source file src/helpers.ts is named by no technical record, directly or through a folder.',
    );
    // The source setting narrows what counts as source; an empty or wrong one is refused.
    writeFileSync(path.join(root, 'lathe.config.json'), JSON.stringify({ schema: SCHEMA_VERSION, data: 'data', source: ['src/**/*.ts'] }));
    expect(untraced(await loadWorkspace(root)).map((g) => g.id)).toEqual(['src/helpers.ts']);
    writeFileSync(path.join(root, 'lathe.config.json'), JSON.stringify({ data: 'data', source: [] }));
    expect(() => loadConfig(root)).toThrow(/source must list globs of the source files/);
    // A product with no source files has no such gap.
    expect(untraced(await loadData(data))).toEqual([]);
  });
});
