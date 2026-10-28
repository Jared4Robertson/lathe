// Traceability's flows run from the command line, each walked through the real `lathe` command on a temporary
// product: coverage by domain and obligation kind, how a test is run and named, tests by state, and the rules of the
// patterns a domain follows. The flows a Reader walks in the app are in app/stability/traceability.spec.ts.
import { afterAll, describe, expect, it } from 'vitest';
import { add, flags, gapsOf, LENDING, link, problemsOf, product, removeProducts, type Product } from './product.ts';

afterAll(removeProducts);

/** The loan flow: a step that opens the loan, fulfilling the first requirement, and its command's handler. */
const DESIGNED = [
  add('flow', { id: 'TL-LEND-UC01-FL', title: 'Borrow a tool', use_case_id: 'TL-LEND-UC01' }),
  add('flow_step', { id: 'TL-LEND-UC01-FL-S01', title: 'The member borrows a free tool', flow_id: 'TL-LEND-UC01-FL', path: 'main', position: 1 }),
  link('TL-LEND-UC01-FL-S01', 'invokes', 'TL-LEND-CMD01'),
  link('TL-LEND-UC01-FL-S01', 'fulfills', 'TL-LEND-UC01-R01'),
  add('command_handler', { id: 'TL-LEND-CMD01-H', title: 'Open a loan', command_id: 'TL-LEND-CMD01', file: 'src/loans.ts' }),
];

/** A pattern with one setting and two rules, the second depending on the setting. */
const PATTERN = [
  add('pattern', { id: 'TL-PAT-ACT', title: 'Librarian action', product_id: 'TL' }),
  { op: 'add' as const, table: 'pattern_setting', row: { pattern_id: 'TL-PAT-ACT', position: 1, name: 'record', meaning: 'The record the action saves.' } },
  add('pattern_rule', { id: 'TL-PAT-ACT-R01', title: 'A saved record reads the same', pattern_id: 'TL-PAT-ACT', statement: 'A record MUST read back as it was saved.' }),
];

/** A shop domain beside lending, with one use case. */
const SHOP = [
  add('domain', { id: 'TL-SHOP', title: 'Shop', product_id: 'TL', subdomain_type: 'supporting' }),
  add('capability', { id: 'TL-SHOP-CAP01', title: 'Selling', domain_id: 'TL-SHOP', position: 1 }),
  add('use_case', { id: 'TL-SHOP-UC01', title: 'Sell a tool', capability_id: 'TL-SHOP-CAP01' }),
];

/** The coverage line of one domain and obligation kind, as the check prints it. */
const line = (out: string, scope: string, label: string) => out.split('\n').find((l) => l.startsWith(`  ${scope} ${label}: `))?.trim();

/** The obligation coverage of one domain and kind, from the check's JSON. */
const coverage = (tl: Product, domain: string | null, kind: string) => tl.workspace().coverage.find((c) => c.domain === domain)?.obligations.find((o) => o.kind === kind);

describe('Traceability flows from the command line', () => {
  it('LA-TRC-UC01-FL-T see a domain\'s coverage', async () => {
    const tl = product();
    await tl.seed([
      ...LENDING,
      ...DESIGNED,
      add('uc_requirement', { id: 'TL-LEND-UC01-R02', title: 'A member in debt is refused', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse a member who owes a fee.' }),
      add('use_case_test', { id: 'TL-LEND-UC01-R01-T01', title: 'A tool on loan is refused', uc_requirement_id: 'TL-LEND-UC01-R01', level: 'api', state: 'automated', file: 'test/loans.test.ts' }),
      add('use_case_test', { id: 'TL-LEND-UC01-R02-T01', title: 'A member in debt is refused', uc_requirement_id: 'TL-LEND-UC01-R02', level: 'api', state: 'not automated yet' }),
    ]);
    tl.write('src/loans.ts', '// TL-LEND-CMD01-H\n');
    tl.write('test/loans.test.ts', "it('TL-LEND-UC01-R01-T01 a tool on loan is refused');\n");
    // S01: one coverage line per domain and obligation kind.
    const result = tl.check();
    expect(line(result.stdout, 'TL-LEND', 'UC requirement')).toBe('TL-LEND UC requirement: 1/2 designed, 1/2 built, 1/2 proved, 1/2 not automated yet');
    // S02: each gap names the obligation and what it lacks.
    expect(result.stdout).toMatch(/\n {4}gap: [^\n]*TL-LEND-UC01-R02[^\n]*\n/);
    expect(gapsOf(tl.workspace(), 'TL-LEND').filter((g) => g.endsWith('TL-LEND-UC01-R02'))).toEqual(['designed TL-LEND-UC01-R02', 'proved TL-LEND-UC01-R02']);
    // S03: the gaps are warnings, so the check still passes.
    expect(result.status).toBe(0);
    expect(problemsOf(tl.workspace(), 'not-proved')).toEqual([expect.stringMatching(/^TL-LEND-UC01-R02: /)]);
    // S04: an Agent closes the gap, and the next check counts it.
    tl.run('add', 'flow_step', '--id', 'TL-LEND-UC01-FL-S02', '--title', 'The member owes nothing', '--flow_id', 'TL-LEND-UC01-FL', '--path', 'main', '--position', '2');
    tl.run('link', 'TL-LEND-UC01-FL-S02', 'invokes', 'TL-LEND-CMD01');
    tl.run('link', 'TL-LEND-UC01-FL-S02', 'fulfills', 'TL-LEND-UC01-R02');
    tl.run('set', 'TL-LEND-UC01-R02-T01', '--state', 'automated', '--file', 'test/loans.test.ts');
    tl.write('test/loans.test.ts', "it('TL-LEND-UC01-R01-T01 a tool on loan is refused');\nit('TL-LEND-UC01-R02-T01 a member in debt is refused');\n");
    expect(line(tl.check().stdout, 'TL-LEND', 'UC requirement')).toBe('TL-LEND UC requirement: 2/2 designed, 2/2 built, 2/2 proved');
  });

  it('LA-TRC-UC02-FL-T count coverage by the meta-model', async () => {
    const tl = product();
    await tl.seed([
      ...LENDING,
      ...DESIGNED,
      add('value_object', { id: 'TL-VO01', title: 'Email address' }),
      { op: 'add', table: 'value_object_field', row: { value_object_id: 'TL-VO01', position: 1, name: 'Address', meaning: 'The address as typed.', type: 'text', required: true } },
      { op: 'add', table: 'entity_field', row: { entity_id: 'TL-LEND-EN01', position: 2, name: 'Borrower email', meaning: 'Where reminders go.', type_value_object_id: 'TL-VO01', required: true } },
      add('constraint', { id: 'TL-VO01-C01', title: 'One at sign', value_object_id: 'TL-VO01', statement: 'An email address MUST hold exactly one @.' }),
      add('value_type', { id: 'TL-VO01-VT', title: 'Email address', value_object_id: 'TL-VO01', file: 'src/email.ts' }),
      add('invariant', { id: 'TL-LEND-INV01', title: 'One active loan per tool', aggregate_id: 'TL-LEND-A1', statement: 'A tool MUST NOT have two active loans.' }),
      add('product_kind', { name: 'house_rule', product_id: 'TL', label: 'House rule', description: 'A rule of the house.', parent_kind: 'domain', stage: 'use-cases', obligation: true }),
      add('product_relation', { name: 'checks_rule', source_kind: 'use_case_test', target_kind: 'house_rule', product_id: 'TL', role: 'proof', forward_label: 'Checks', reverse_label: 'Checked by', description: 'The test checks the rule.' }),
    ]);
    await tl.seed([add('house_rule', { id: 'TL-LEND-HR01', title: 'Quiet', domain_id: 'TL-LEND' })]);
    tl.write('src/loans.ts', '// TL-LEND-CMD01-H\n');
    tl.write('src/email.ts', '// TL-VO01-VT\n');
    tl.write('test/email.test.ts', "it('TL-VO01-C01-T one at sign');\n");
    tl.write('test/loans.test.ts', "it('TL-LEND-UC01-R01-T01 a tool on loan is refused');\n");
    // S01: a product with every obligation kind it uses, its own kind among them.
    tl.run('add', 'constraint_test', '--id', 'TL-VO01-C01-T', '--title', 'One at sign', '--constraint_id', 'TL-VO01-C01', '--level', 'unit', '--state', 'automated', '--file', 'test/email.test.ts');
    // S02: a test at a level its kind does not allow proves nothing.
    tl.run('add', 'use_case_test', '--id', 'TL-LEND-UC01-R01-T01', '--title', 'A tool on loan is refused', '--uc_requirement_id', 'TL-LEND-UC01-R01', '--level', 'unit', '--state', 'automated', '--file', 'test/loans.test.ts');
    tl.run('link', 'TL-LEND-UC01-R01-T01', 'checks_rule', 'TL-LEND-HR01');
    expect(coverage(tl, 'TL-LEND', 'uc_requirement')).toMatchObject({ total: 1, designed: 1, built: 1, proved: 0 });
    tl.run('set', 'TL-LEND-UC01-R01-T01', '--level', 'api');
    expect(coverage(tl, 'TL-LEND', 'uc_requirement')).toMatchObject({ total: 1, designed: 1, built: 1, proved: 1 });
    // S03: an obligation with only a test not automated yet counts as that, not proved.
    tl.run('add', 'invariant_test', '--id', 'TL-LEND-INV01-T', '--title', 'One active loan per tool', '--invariant_id', 'TL-LEND-INV01', '--level', 'database', '--state', 'not automated yet');
    expect(coverage(tl, 'TL-LEND', 'invariant')).toMatchObject({ total: 1, proved: 0, not_automated: 1 });
    // S04: one line per domain and obligation kind in the schema's order, the product's own kind after Lathe's.
    const out = tl.check().stdout;
    const lines = out.split('\n').filter((l) => /^ {2}TL[^ ]* .+: /.test(l) && !l.includes(' tests: ')).map((l) => l.trim());
    expect(lines).toEqual([
      'TL-LEND constraint: 1/1 designed, 1/1 built, 1/1 proved',
      'TL-LEND invariant: 1/1 designed, 0/1 built, 0/1 proved, 1/1 not automated yet',
      'TL-LEND UC requirement: 1/1 designed, 1/1 built, 1/1 proved',
      'TL-LEND house rule: 0/1 designed, 0/1 built, 1/1 proved',
    ]);
    // S05: the report lists, as gaps, a capability that serves no business outcome until it serves one.
    expect(out).toContain('[capability-serves-no-outcome] Capability TL-LEND-CAP01 serves no business outcome.');
    tl.run('add', 'business_outcome', '--id', 'TL-BO01', '--title', 'More tools in use', '--product_id', 'TL', '--statement', 'Members borrow more tools.', '--measure', 'Loans per tool per month.', '--target', 'Two within a year.');
    expect(tl.check().stdout).toContain('[outcome-not-served] Business outcome TL-BO01 is served by no capability.');
    tl.run('link', 'TL-LEND-CAP01', 'serves', 'TL-BO01');
    expect(tl.check().stdout).not.toMatch(/outcome-not-served|capability-serves-no-outcome/);
    // S07: and an outcome nothing measures, until a test that runs measures it.
    expect(tl.check().stdout).toContain('[outcome-not-measured] Business outcome TL-BO01 is measured by nothing;');
    tl.run('link', 'TL-BO01', 'measured_by', 'TL-LEND-UC01-R01-T01');
    expect(tl.check().stdout).not.toContain('outcome-not-measured');
  });

  it('LA-TRC-UC03-FL-T record how a test is run', async () => {
    const tl = product();
    await tl.seed([...LENDING, add('uc_requirement', { id: 'TL-LEND-UC01-R02', title: 'A member in debt is refused', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse a member who owes a fee.' }), add('uc_requirement', { id: 'TL-LEND-UC01-R03', title: 'The due date is set', use_case_id: 'TL-LEND-UC01', statement: 'The loan MUST be due two weeks after it opens.' })]);
    const test = (requirement: string, run: Record<string, string>) =>
      ['add', 'use_case_test', ...flags({ id: `${requirement}-T01`, title: 'A test', uc_requirement_id: requirement, ...run })];
    // S01, S02: the test under what it proves, automated with the file that runs it.
    tl.write('test/loans.test.ts', "it('TL-LEND-UC01-R01-T01 a tool on loan is refused');\n");
    tl.run(...test('TL-LEND-UC01-R01', { level: 'api', state: 'automated', file: 'test/loans.test.ts' }));
    // S03: a manual test gives its reason and its procedure.
    tl.run(...test('TL-LEND-UC01-R02', { level: 'manual', state: 'manual', manual_reason: 'Manual because the fee is read off the paper ledger.', given: 'A member who owes a fee', when: 'They borrow a tool', then: 'The librarian refuses the loan' }));
    // S04: a test not automated yet may name its file; until the file exists that is a warning.
    tl.run(...test('TL-LEND-UC01-R03', { level: 'api', state: 'not automated yet', file: 'test/dates.test.ts' }));
    const ws = tl.workspace();
    expect(ws.problems.filter((p) => p.check === 'test-file-missing').map((p) => [p.severity, p.record])).toEqual([['warning', 'TL-LEND-UC01-R03-T01']]);
    expect(ws.coverage.find((c) => c.domain === 'TL-LEND')?.tests).toEqual({ automated: 1, manual: 1, not_automated: 1 });
    // S05: an unknown state or level, an automated test with no file and a manual reason on a test that is not manual.
    const refusals = [
      tl.refused('set', 'TL-LEND-UC01-R03-T01', '--state', 'planned'),
      tl.refused('set', 'TL-LEND-UC01-R03-T01', '--level', 'system'),
      tl.refused('set', 'TL-LEND-UC01-R03-T01', '--state', 'automated', '--file', ''),
      tl.refused('set', 'TL-LEND-UC01-R03-T01', '--manual_reason', 'Because.'),
    ];
    expect(refusals[0]).toContain('state');
    expect(refusals[1]).toContain('level');
    expect(refusals[2]).toContain('file');
    expect(refusals[3]).toContain('manual_reason');
    // S06: its size and markers: small unless it says otherwise, and a marker only when it is set.
    tl.run('set', 'TL-LEND-UC01-R01-T01', '--size', 'volume', '--smoke', 'true');
    expect(tl.workspace().records.find((r) => r.id === 'TL-LEND-UC01-R01-T01')?.fields).toMatchObject({ size: 'volume', smoke: true });
    expect(tl.refused('set', 'TL-LEND-UC01-R01-T01', '--size', 'small')).toContain('size');
    expect(tl.refused('set', 'TL-LEND-UC01-R01-T01', '--external', 'false')).toContain('external');
  });

  it('LA-TRC-UC04-FL-T prove the rules of the patterns a domain follows', async () => {
    const tl = product();
    await tl.seed([...LENDING, ...SHOP, add('pattern', { id: 'TL-PAT-ACT', title: 'Librarian action', product_id: 'TL' }), { op: 'add', table: 'pattern_setting', row: { pattern_id: 'TL-PAT-ACT', position: 1, name: 'record', meaning: 'The record the action saves.' } }]);
    // S01: the pattern's rules, each naming the setting it depends on, if any.
    tl.run('add', 'pattern_rule', '--id', 'TL-PAT-ACT-R01', '--title', 'A saved record reads the same', '--pattern_id', 'TL-PAT-ACT', '--statement', 'A record MUST read back as it was saved.');
    tl.run('add', 'pattern_rule', '--id', 'TL-PAT-ACT-R02', '--title', 'The saved record is named', '--pattern_id', 'TL-PAT-ACT', '--statement', 'The action MUST name the record it saves.', '--setting', 'record');
    // S07: a pattern nobody follows is a warning.
    expect(problemsOf(tl.workspace(), 'pattern-not-followed')).toEqual([expect.stringMatching(/^TL-PAT-ACT: /)]);
    // S03: lending follows it as a domain; the shop through a use case that has no record to name.
    tl.run('link', 'TL-LEND', 'follows', 'TL-PAT-ACT');
    tl.run('link', 'TL-SHOP-UC01', 'follows', 'TL-PAT-ACT');
    tl.run('add', 'setting_value', '--follower_id', 'TL-SHOP-UC01', '--pattern_id', 'TL-PAT-ACT', '--setting', 'record', '--not_applicable', 'A sale saves no record of ours.');
    expect(problemsOf(tl.workspace(), 'pattern-not-followed')).toEqual([]);
    // S05, S06: each rule counts once in each domain that owes it, leaving out where it is not applicable.
    expect(coverage(tl, 'TL-LEND', 'pattern_rule')).toMatchObject({ total: 2, proved: 0, proof_only: true });
    expect(coverage(tl, 'TL-SHOP', 'pattern_rule')).toMatchObject({ total: 1, proved: 0 });
    expect(problemsOf(tl.workspace(), 'not-proved').filter((p) => p.startsWith('TL-PAT-ACT')).sort()).toEqual([
      expect.stringMatching(/^TL-PAT-ACT-R01: .*TL-LEND/),
      expect.stringMatching(/^TL-PAT-ACT-R01: .*TL-SHOP/),
      expect.stringMatching(/^TL-PAT-ACT-R02: .*TL-LEND/),
    ]);
    // S04: one pattern rule test per rule in each following domain, naming the domain.
    tl.write('test/actions.test.ts', ['TL-PAT-ACT-R01-T01', 'TL-PAT-ACT-R01-T02', 'TL-PAT-ACT-R02-T01'].map((id) => `it('${id}');\n`).join(''));
    for (const [id, rule, domain] of [['TL-PAT-ACT-R01-T01', 'TL-PAT-ACT-R01', 'TL-LEND'], ['TL-PAT-ACT-R01-T02', 'TL-PAT-ACT-R01', 'TL-SHOP'], ['TL-PAT-ACT-R02-T01', 'TL-PAT-ACT-R02', 'TL-LEND']]) {
      tl.run('add', 'pattern_rule_test', '--id', id, '--title', 'A rule proved', '--pattern_rule_id', rule, '--domain_id', domain, '--level', 'api', '--state', 'automated', '--file', 'test/actions.test.ts');
    }
    const out = tl.check().stdout;
    expect(line(out, 'TL-LEND', 'pattern rule')).toBe('TL-LEND pattern rule: proof only, 2/2 proved');
    expect(line(out, 'TL-SHOP', 'pattern rule')).toBe('TL-SHOP pattern rule: proof only, 1/1 proved');
    // S07: an obligation outside every domain counts in the product's Shared coverage.
    await tl.seed([
      add('value_object', { id: 'TL-VO01', title: 'Email address' }),
      { op: 'add', table: 'entity_field', row: { entity_id: 'TL-LEND-EN01', position: 2, name: 'Borrower email', meaning: 'Where reminders go.', type_value_object_id: 'TL-VO01', required: true } },
      { op: 'add', table: 'entity_field', row: { entity_id: 'TL-LEND-EN01', position: 3, name: 'Shop email', meaning: 'Where receipts go.', type_value_object_id: 'TL-VO01', required: false } },
      add('aggregate', { id: 'TL-SHOP-A1', title: 'Sale', domain_id: 'TL-SHOP' }),
      add('entity', { id: 'TL-SHOP-EN01', title: 'Sale', aggregate_id: 'TL-SHOP-A1', role: 'root' }),
      { op: 'add', table: 'entity_field', row: { entity_id: 'TL-SHOP-EN01', position: 1, name: 'Buyer email', meaning: 'Where the receipt goes.', type_value_object_id: 'TL-VO01', required: true } },
      add('constraint', { id: 'TL-VO01-C01', title: 'One at sign', value_object_id: 'TL-VO01', statement: 'An email address MUST hold exactly one @.' }),
    ]);
    expect(coverage(tl, null, 'constraint')).toMatchObject({ total: 1 });
    // S02: a rule naming a setting its pattern does not have is refused.
    expect(tl.refused('add', 'pattern_rule', '--id', 'TL-PAT-ACT-R03', '--title', 'The member is named', '--pattern_id', 'TL-PAT-ACT', '--statement', 'The action MUST name the member.', '--setting', 'member')).toContain('setting');
  });

  it('LA-TRC-UC05-FL-T check that each test\'s file names it', async () => {
    const tl = product();
    await tl.seed([...LENDING, add('uc_requirement', { id: 'TL-LEND-UC01-R02', title: 'A member in debt is refused', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse a member who owes a fee.' }), add('uc_requirement', { id: 'TL-LEND-UC01-R03', title: 'The due date is set', use_case_id: 'TL-LEND-UC01', statement: 'The loan MUST be due two weeks after it opens.' })]);
    // S01: the Agent writes the test's code, but names a longer ID, not the test's own.
    tl.write('test/loans.test.ts', "it('TL-LEND-UC01-R01-T011 a tool on loan is refused');\n");
    tl.run('add', 'use_case_test', ...flags({ id: 'TL-LEND-UC01-R01-T01', title: 'A tool on loan is refused', uc_requirement_id: 'TL-LEND-UC01-R01', level: 'api', state: 'automated', file: 'test/loans.test.ts' }));
    // S02, S03: the check reads the file for the whole ID, and a file that does not name its test is an error.
    const silent = tl.check();
    expect(silent.status).toBe(1);
    expect(silent.stdout).toMatch(/\[test-file-missing-id\] TL-LEND-UC01-R01-T01: [^\n]*test\/loans\.test\.ts/);
    tl.write('test/loans.test.ts', "it('TL-LEND-UC01-R01-T01 a tool on loan is refused');\n");
    expect(problemsOf(tl.workspace(), 'test-file-missing-id')).toEqual([]);
    // S04: a manual test's file and one not automated yet are checked only for existing.
    tl.write('docs/ledger.md', 'How the ledger is read.\n');
    tl.run('add', 'use_case_test', ...flags({ id: 'TL-LEND-UC01-R02-T01', title: 'A member in debt is refused', uc_requirement_id: 'TL-LEND-UC01-R02', level: 'manual', state: 'manual', manual_reason: 'Manual because the fee is read off the paper ledger.', file: 'docs/ledger.md' }));
    tl.run('add', 'use_case_test', ...flags({ id: 'TL-LEND-UC01-R03-T01', title: 'The due date is set', uc_requirement_id: 'TL-LEND-UC01-R03', level: 'api', state: 'not automated yet', file: 'docs/ledger.md' }));
    const ws = tl.workspace();
    expect(ws.problems.filter((p) => p.severity === 'error')).toEqual([]);
    expect(problemsOf(ws, 'test-file-missing-id')).toEqual([]);
    expect(problemsOf(ws, 'test-file-missing')).toEqual([]);
  });

  it('LA-TRC-UC06-FL-T see each domain\'s tests by state', async () => {
    const tl = product();
    await tl.seed([
      ...LENDING,
      add('uc_requirement', { id: 'TL-LEND-UC01-R02', title: 'A member in debt is refused', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse a member who owes a fee.' }),
      add('uc_requirement', { id: 'TL-LEND-UC01-R03', title: 'The due date is set', use_case_id: 'TL-LEND-UC01', statement: 'The loan MUST be due two weeks after it opens.' }),
      add('use_case_test', { id: 'TL-LEND-UC01-R01-T01', title: 'A tool on loan is refused', uc_requirement_id: 'TL-LEND-UC01-R01', level: 'api', state: 'automated', file: 'test/loans.test.ts' }),
      add('use_case_test', { id: 'TL-LEND-UC01-R02-T01', title: 'A member in debt is refused', uc_requirement_id: 'TL-LEND-UC01-R02', level: 'manual', state: 'manual', manual_reason: 'Manual because the fee is read off the paper ledger.' }),
      add('use_case_test', { id: 'TL-LEND-UC01-R03-T01', title: 'The due date is set', uc_requirement_id: 'TL-LEND-UC01-R03', level: 'api', state: 'not automated yet' }),
      ...SHOP,
    ]);
    tl.write('test/loans.test.ts', "it('TL-LEND-UC01-R01-T01 a tool on loan is refused');\n");
    // S01: after each domain's obligation lines, its tests by state.
    const out = tl.check().stdout.split('\n');
    const at = out.indexOf('  TL-LEND tests: 1 automated, 1 manual, 1 not automated yet');
    expect(at).toBeGreaterThan(out.findIndex((l) => l.startsWith('  TL-LEND UC requirement: ')));
    // S02: an Agent reads the same counts from the JSON, on each domain's coverage.
    const ws = tl.workspace();
    expect(Object.fromEntries(ws.coverage.map((c) => [c.domain, c.tests]))).toEqual({
      'TL-LEND': { automated: 1, manual: 1, not_automated: 1 },
      'TL-SHOP': { automated: 0, manual: 0, not_automated: 0 },
      null: { automated: 0, manual: 0, not_automated: 0 },
    });
  });

  it('LA-TRC-UC07-FL-T follow a pattern per domain, with or without settings', async () => {
    const tl = product();
    await tl.seed([
      ...LENDING,
      add('use_case', { id: 'TL-LEND-UC02', title: 'Renew a loan', capability_id: 'TL-LEND-CAP01' }),
      ...PATTERN,
      add('pattern', { id: 'TL-PAT-LOG', title: 'Audit log', product_id: 'TL' }),
      add('pattern_rule', { id: 'TL-PAT-LOG-R01', title: 'Every change is logged', pattern_id: 'TL-PAT-LOG', statement: 'Each change MUST be written to the audit log.' }),
    ]);
    // S01: the Owner links the domain to a pattern with no settings.
    tl.run('link', 'TL-LEND', 'follows', 'TL-PAT-LOG');
    // S02: a use case follows the pattern with a setting, and gives its value.
    tl.run('link', 'TL-LEND-UC02', 'follows', 'TL-PAT-ACT');
    expect(problemsOf(tl.workspace(), 'pattern-setting-missing')).toEqual([expect.stringMatching(/^TL-LEND-UC02: /)]);
    tl.run('add', 'setting_value', '--follower_id', 'TL-LEND-UC02', '--pattern_id', 'TL-PAT-ACT', '--setting', 'record', '--value', 'Loan');
    const ws = tl.workspace();
    expect(problemsOf(ws, 'pattern-setting-missing')).toEqual([]);
    // S03: each rule counts once in the domain, asking only for proof.
    expect(ws.coverage.find((c) => c.domain === 'TL-LEND')?.obligations.find((o) => o.kind === 'pattern_rule')).toMatchObject({ total: 2, proof_only: true, proved: 0 });
    expect(gapsOf(ws, 'TL-LEND').filter((g) => g.includes('TL-PAT-'))).toEqual(['proved TL-PAT-ACT-R01', 'proved TL-PAT-LOG-R01']);
    // S04: the use case that follows a pattern is not asked for requirements of its own.
    expect(gapsOf(ws, 'TL-LEND').filter((g) => g.startsWith('use-case-without-requirement'))).toEqual([]);
    // S05: a product kind declared an obligation is counted like Lathe's.
    tl.run('add', 'product_kind', ...flags({ name: 'house_rule', product_id: 'TL', label: 'House rule', description: 'A rule of the house.', parent_kind: 'domain', stage: 'use-cases', obligation: true }));
    tl.run('add', 'house_rule', '--id', 'TL-LEND-HR01', '--title', 'Quiet', '--domain_id', 'TL-LEND');
    expect(coverage(tl, 'TL-LEND', 'house_rule')).toMatchObject({ label: 'House rule', total: 1, proved: 0 });
    // S06: a product kind named like one of Lathe's tables is refused.
    expect(tl.refused('add', 'product_kind', ...flags({ name: 'invariant', product_id: 'TL', label: 'Our invariant', description: 'A rule of ours.', parent_kind: 'domain', obligation: true }))).toContain('invariant');
  });

  it('LA-TRC-UC08-FL-T report pattern rule tests that count nowhere and silent manual test files', async () => {
    const tl = product();
    await tl.seed([
      ...LENDING,
      ...SHOP,
      ...PATTERN,
      link('TL-LEND', 'follows', 'TL-PAT-ACT'),
      add('use_case_test', { id: 'TL-LEND-UC01-R01-T01', title: 'A tool on loan is refused', uc_requirement_id: 'TL-LEND-UC01-R01', level: 'manual', state: 'manual', manual_reason: 'Manual because the librarian checks the shelf.', file: 'docs/shelf.md' }),
      add('pattern_rule_test', { id: 'TL-PAT-ACT-R01-T01', title: 'A saved record reads the same', pattern_rule_id: 'TL-PAT-ACT-R01', domain_id: 'TL-SHOP', level: 'api', state: 'automated', file: 'test/actions.test.ts' }),
    ]);
    tl.write('test/actions.test.ts', "it('TL-PAT-ACT-R01-T01');\n");
    tl.write('docs/shelf.md', 'Look at the shelf.\n');
    // S01: the Owner runs lathe check.
    const ws = tl.workspace();
    // S02: a pattern rule test in a domain that does not owe its rule, with the reason.
    expect(ws.problems.filter((p) => p.check === 'pattern-rule-test-outside-followers').map((p) => [p.severity, p.record])).toEqual([['error', 'TL-PAT-ACT-R01-T01']]);
    expect(problemsOf(ws, 'pattern-rule-test-outside-followers')[0]).toContain('TL-SHOP');
    // S03: a manual test whose file does not name it is a warning.
    expect(ws.problems.filter((p) => p.check === 'manual-test-file-silent').map((p) => [p.severity, p.record])).toEqual([['warning', 'TL-LEND-UC01-R01-T01']]);
    const out = tl.check().stdout;
    expect(out).toContain('[pattern-rule-test-outside-followers] TL-PAT-ACT-R01-T01:');
    expect(out).toContain('[manual-test-file-silent] TL-LEND-UC01-R01-T01:');
  });
});
