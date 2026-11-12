// Tracing code split across helper files, walked through the real `lathe` command on a temporary product: a helper
// file is a code-file-untraced gap until a technical record names it, one record names each, the record builds only
// while every one of its files exists, and the trace lists every file with its record.
import { rmSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { add, gapsOf, LENDING, link, problemsOf, product, removeProducts } from './product.ts';

afterAll(removeProducts);

describe('Helper files from the command line', () => {
  it('LA-STD-TRACEABILITY-R02-T06 trace code split across helper files', async () => {
    const tl = product();
    await tl.seed([
      ...LENDING,
      add('flow', { id: 'TL-LEND-UC01-FL', title: 'Borrow a tool', use_case_id: 'TL-LEND-UC01' }),
      add('flow_step', { id: 'TL-LEND-UC01-FL-S01', title: 'The member asks for a free tool', flow_id: 'TL-LEND-UC01-FL', path: 'main', position: 1 }),
      link('TL-LEND-UC01-FL-S01', 'fulfills', 'TL-LEND-UC01-R01'),
      link('TL-LEND-UC01-FL-S01', 'invokes', 'TL-LEND-CMD01'),
      add('command_handler', { id: 'TL-LEND-CMD01-H', title: 'openLoan', command_id: 'TL-LEND-CMD01', file: 'src/loans.ts', description: 'Saves the loan under a lock.' }),
    ]);
    tl.write('src/loans.ts', '// TL-LEND-CMD01-H\n');
    tl.write('src/lock_unix.ts', 'export {};\n');
    tl.write('src/lock_other.ts', 'export {};\n');
    // S02 before S01: each helper file no record names is a code-file-untraced gap on the product.
    expect(gapsOf(tl.workspace(), null)).toEqual(expect.arrayContaining(['code-file-untraced src/lock_other.ts', 'code-file-untraced src/lock_unix.ts']));
    // S01: the Agent names the helper files on the handler; a use case's commands take none, and no other record may name one.
    expect(tl.lathe('use-case', 'change-use-case', '--id', 'TL-LEND-UC01', '--helpers', 'src/lock_unix.ts').stderr).toContain('has no field helpers');
    tl.command('command change-command-handler', { id: 'TL-LEND-CMD01-H', helpers: ['src/lock_unix.ts', 'src/lock_other.ts'] });
    expect(tl.refuse('tooling add-tooling', { id: 'TL-LEND-TOOL01', title: 'lock', domain_id: 'TL-LEND', file: 'scripts/lock.ts', helpers: ['src/lock_unix.ts'] })).toContain('helper_file');
    // S02: no helper file is a gap now.
    const named = tl.workspace();
    expect(gapsOf(named, null).filter((g) => g.startsWith('code-file-untraced'))).toEqual([]);
    const built = (ws: ReturnType<typeof tl.workspace>) => ws.coverage.find((c) => c.domain === 'TL-LEND')?.obligations.find((o) => o.kind === 'uc_requirement')?.built;
    expect(built(named)).toBe(1);
    // S04: the requirement's trace lists the handler's file and both helper files, each named by the handler.
    expect(named.chains.find((c) => c.obligation === 'TL-LEND-UC01-R01')?.files).toEqual(expect.arrayContaining([
      { path: 'src/loans.ts', named_by: ['TL-LEND-CMD01-H'] },
      { path: 'src/lock_other.ts', named_by: ['TL-LEND-CMD01-H'] },
      { path: 'src/lock_unix.ts', named_by: ['TL-LEND-CMD01-H'] },
    ]));
    // S03: a helper file not written yet is a missing file of the handler, and the requirement is not built.
    rmSync(path.join(tl.root, 'src/lock_other.ts'));
    const missing = tl.workspace();
    expect(problemsOf(missing, 'technical-file-missing')).toEqual(['TL-LEND-CMD01-H: Command handler TL-LEND-CMD01-H names src/lock_other.ts, which does not exist yet.']);
    expect(built(missing)).toBe(0);
  });
});
