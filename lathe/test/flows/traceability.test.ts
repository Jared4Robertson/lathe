// Traceability's flows run from the command line, each walked through the real `lathe` command on a temporary
// product: coverage by domain and obligation kind, how a test is run and named, tests by state, and the rules of the
// patterns a domain follows. The flows a Reader walks in the app are in app/stability/traceability.spec.ts.
import { afterAll, describe, expect, it } from 'vitest';
import { add, gapsOf, LENDING, link, problemsOf, product, removeProducts, type Product } from './product.ts';

afterAll(removeProducts);

/** The loan flow: a step that opens the loan, fulfilling the first requirement, and its command's handler. */
const DESIGNED = [
  add('interface', { id: 'TL-IF01', title: 'Loan desk', product_id: 'TL', kind: 'web app', description: 'The desk where librarians lend tools.', public: false }),
  link('TL-IF01', 'offers', 'TL-LEND-UC01'),
  add('flow', { id: 'TL-LEND-UC01-FL', title: 'Borrow a tool', use_case_id: 'TL-LEND-UC01' }),
  add('flow_step', { id: 'TL-LEND-UC01-FL-S01', title: 'The member borrows a free tool', flow_id: 'TL-LEND-UC01-FL', path: 'main', position: 1 }),
  link('TL-LEND-UC01-FL-S01', 'invokes', 'TL-LEND-CMD01'),
  link('TL-LEND-UC01-FL-S01', 'fulfills', 'TL-LEND-UC01-R01'),
  add('command_handler', { id: 'TL-LEND-CMD01-H', title: 'openLoan', command_id: 'TL-LEND-CMD01', file: 'src/loans.ts', description: 'Opens the loan in one transaction.' }),
];

/** A pattern with one setting and one rule. */
const PATTERN = [
  add('pattern', { id: 'TL-PAT-ACT', title: 'Librarian action', product_id: 'TL', description: 'An action a librarian takes that saves a record.' }),
  add('pattern_setting', { pattern_id: 'TL-PAT-ACT', position: 1, name: 'record', meaning: 'The record the action saves.' }),
  add('pattern_rule', { id: 'TL-PAT-ACT-R01', title: 'A saved record reads the same', pattern_id: 'TL-PAT-ACT', statement: 'A record MUST read back as it was saved.' }),
];

/** A shop domain beside lending, with one use case. */
const SHOP = [
  add('domain', { id: 'TL-SHOP', title: 'Shop', product_id: 'TL', subdomain_type: 'supporting', description: 'Selling tools the library no longer lends.' }),
  add('capability', { id: 'TL-SHOP-CAP01', title: 'Selling', domain_id: 'TL-SHOP', position: 1, description: 'Selling tools to members.' }),
  add('use_case', { id: 'TL-SHOP-UC01', title: 'Sell a tool', capability_id: 'TL-SHOP-CAP01', goal: 'A member buys a tool.' }),
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
      add('use_case_test', { id: 'TL-LEND-UC01-R01-T01', title: 'A tool on loan is refused', uc_requirement_id: 'TL-LEND-UC01-R01', level: 'service', state: 'automated', file: 'test/loans.test.ts', when: 'A member borrows a tool that is on loan', then: 'The loan is refused' }),
      add('use_case_test', { id: 'TL-LEND-UC01-R02-T01', title: 'A member in debt is refused', uc_requirement_id: 'TL-LEND-UC01-R02', level: 'service', state: 'not automated yet', when: 'A member who owes a fee borrows a tool', then: 'The loan is refused' }),
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
    tl.command('use-case add-flow-step', { id: 'TL-LEND-UC01-FL-S03', title: 'The member owes nothing', flow_id: 'TL-LEND-UC01-FL', path: 'main', position: 2, invokes: 'TL-LEND-CMD01', fulfills: ['TL-LEND-UC01-R02'] });
    tl.command('use-case change-use-case-test', { id: 'TL-LEND-UC01-R02-T01', state: 'automated', file: 'test/loans.test.ts' });
    tl.write('test/loans.test.ts', "it('TL-LEND-UC01-R01-T01 a tool on loan is refused');\nit('TL-LEND-UC01-R02-T01 a member in debt is refused');\n");
    expect(line(tl.check().stdout, 'TL-LEND', 'UC requirement')).toBe('TL-LEND UC requirement: 2/2 designed, 2/2 built, 2/2 proved');
  });

  it('LA-TRC-UC02-FL-T count coverage by the meta-model', async () => {
    const tl = product();
    await tl.seed([
      ...LENDING,
      ...DESIGNED,
      add('value_object', { id: 'TL-VO01', title: 'Email address', description: 'Where a member gets mail.' }),
      add('value_object_field', { value_object_id: 'TL-VO01', position: 1, name: 'Address', meaning: 'The address as typed.', type: 'text', required: true }),
      add('entity_field', { entity_id: 'TL-LEND-EN01', position: 2, name: 'Borrower email', meaning: 'Where reminders go.', type_value_object_id: 'TL-VO01', required: true }),
      add('constraint', { id: 'TL-VO01-C01', title: 'One at sign', value_object_id: 'TL-VO01', statement: 'An email address MUST hold exactly one @.' }),
      add('value_type', { id: 'TL-VO01-VT', title: 'EmailAddress', value_object_id: 'TL-VO01', file: 'src/email.ts' }),
      add('invariant', { id: 'TL-LEND-INV01', title: 'One active loan per tool', aggregate_id: 'TL-LEND-A1', statement: 'A tool MUST NOT have two active loans.' }),
      add('product_kind', { name: 'house_rule', product_id: 'TL', label: 'House rule', description: 'A rule of the house.', parent_kind: 'domain', stage: 'use-cases', obligation: true, complexity: 'essential' }),
      add('product_relation', { name: 'checks_rule', source_kind: 'use_case_test', target_kind: 'house_rule', product_id: 'TL', role: 'proof', forward_label: 'Checks', reverse_label: 'Checked by', description: 'The test checks the rule.' }),
    ]);
    await tl.seed([add('house_rule', { id: 'TL-LEND-HR01', title: 'Quiet', domain_id: 'TL-LEND' })]);
    tl.write('src/loans.ts', '// TL-LEND-CMD01-H\n');
    tl.write('src/email.ts', '// TL-VO01-VT\n');
    tl.write('test/email.test.ts', "it('TL-VO01-C01-T one at sign');\n");
    tl.write('test/loans.test.ts', "it('TL-LEND-UC01-R01-T01 a tool on loan is refused');\n");
    // S01: a product with every obligation kind it uses, its own kind among them.
    tl.command('value-object add-constraint-test', { id: 'TL-VO01-C01-T', title: 'One at sign', constraint_id: 'TL-VO01-C01', level: 'unit', state: 'automated', file: 'test/email.test.ts', accepts: 'ann@example.org', refuses: 'ann.example.org' });
    // S02: a test at a level its kind does not allow proves nothing.
    tl.command('use-case add-use-case-test', { id: 'TL-LEND-UC01-R01-T01', title: 'A tool on loan is refused', uc_requirement_id: 'TL-LEND-UC01-R01', level: 'unit', state: 'automated', file: 'test/loans.test.ts', when: 'A member borrows a tool that is on loan', then: 'The loan is refused' });
    await tl.seed([link('TL-LEND-UC01-R01-T01', 'checks_rule', 'TL-LEND-HR01')]);
    expect(coverage(tl, 'TL-LEND', 'uc_requirement')).toMatchObject({ total: 1, designed: 1, built: 1, proved: 0 });
    tl.command('use-case change-use-case-test', { id: 'TL-LEND-UC01-R01-T01', level: 'service' });
    expect(coverage(tl, 'TL-LEND', 'uc_requirement')).toMatchObject({ total: 1, designed: 1, built: 1, proved: 1 });
    // S03: an obligation with only a test not automated yet counts as that, not proved.
    tl.command('aggregate add-invariant-test', { id: 'TL-LEND-INV01-T', title: 'One active loan per tool', invariant_id: 'TL-LEND-INV01', level: 'integration', state: 'not automated yet', when: 'A second loan opens for a tool on loan', then: 'The store refuses it' });
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
    tl.command('business-outcome add-business-outcome', { id: 'TL-BO01', title: 'More tools in use', product_id: 'TL', statement: 'Members borrow more tools.', measure: 'Loans per tool per month.', target: 'Two within a year.' });
    expect(tl.check().stdout).toContain('[outcome-not-served] Business outcome TL-BO01 is served by no capability.');
    tl.command('domain change-capability', { id: 'TL-LEND-CAP01', serves: ['TL-BO01'] });
    expect(tl.check().stdout).not.toMatch(/outcome-not-served|capability-serves-no-outcome/);
    // S06: a source file no technical record names is a gap, until a record names its folder.
    tl.write('src/lending/rules.ts', 'export const LOAN_DAYS = 14;\n');
    expect(tl.check().stdout).toContain('[code-file-untraced] Source file src/lending/rules.ts is named by no technical record, directly or through a folder.');
    tl.command('domain add-repository', { id: 'TL-LEND-REPO01', title: 'Loans', domain_id: 'TL-LEND', file: 'src/lending', description: 'Keeps loans in one table and reads them by tool.', persists: 'TL-LEND-A1' });
    expect(tl.check().stdout).not.toContain('code-file-untraced');
    // S07: and an outcome nothing measures, until a test that runs measures it.
    expect(tl.check().stdout).toContain('[outcome-not-measured] Business outcome TL-BO01 is measured by nothing;');
    tl.command('business-outcome change-business-outcome', { id: 'TL-BO01', measured_by: ['TL-LEND-UC01-R01-T01'] });
    expect(tl.check().stdout).not.toContain('outcome-not-measured');
  });

  it('LA-TRC-UC03-FL-T record how a test is run', async () => {
    const tl = product();
    await tl.seed([...LENDING, add('uc_requirement', { id: 'TL-LEND-UC01-R02', title: 'A member in debt is refused', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse a member who owes a fee.' }), add('uc_requirement', { id: 'TL-LEND-UC01-R03', title: 'The due date is set', use_case_id: 'TL-LEND-UC01', statement: 'The loan MUST be due two weeks after it opens.' })]);
    const addTest = (requirement: string, run: Record<string, string>) =>
      tl.command('use-case add-use-case-test', { id: `${requirement}-T01`, title: `${requirement} holds`, uc_requirement_id: requirement, ...run });
    // S01, S02: the test under what it proves, automated with the file that runs it.
    tl.write('test/loans.test.ts', "it('TL-LEND-UC01-R01-T01 a tool on loan is refused');\n");
    addTest('TL-LEND-UC01-R01', { level: 'service', state: 'automated', file: 'test/loans.test.ts', when: 'A member borrows a tool that is on loan', then: 'The loan is refused' });
    // S03: a manual test gives its reason and its procedure.
    addTest('TL-LEND-UC01-R02', { level: 'browser', state: 'manual', manual_reason: 'Manual because the fee is read off the paper ledger.', when: 'A member who owes a fee borrows a tool', then: 'The librarian refuses the loan' });
    // S04: a test not automated yet may name its file; until the file exists that is a warning.
    addTest('TL-LEND-UC01-R03', { level: 'service', state: 'not automated yet', file: 'test/dates.test.ts', when: 'A loan opens', then: 'It is due in two weeks' });
    const ws = tl.workspace();
    expect(ws.problems.filter((p) => p.check === 'test-file-missing').map((p) => [p.severity, p.record])).toEqual([['warning', 'TL-LEND-UC01-R03-T01']]);
    expect(ws.coverage.find((c) => c.domain === 'TL-LEND')?.tests).toEqual({ automated: 1, manual: 1, not_automated: 1 });
    // S05: an unknown state or level, an automated test with no file and a manual reason on a test that is not manual.
    const refusals = [
      tl.lathe('use-case', 'change-use-case-test', '--id', 'TL-LEND-UC01-R03-T01', '--state', 'planned').stderr,
      tl.lathe('use-case', 'change-use-case-test', '--id', 'TL-LEND-UC01-R03-T01', '--level', 'e2e-ui').stderr,
      tl.refuse('use-case change-use-case-test', { id: 'TL-LEND-UC01-R03-T01', state: 'automated', file: '' }),
      tl.refuse('use-case change-use-case-test', { id: 'TL-LEND-UC01-R03-T01', manual_reason: 'Because.' }),
    ];
    expect(refusals[0]).toContain('state');
    expect(refusals[1]).toContain('level');
    expect(refusals[2]).toContain('file');
    expect(refusals[3]).toContain('manual_reason');
    // S06: its size and markers: small unless it says otherwise, and a marker only when it is set.
    tl.command('use-case change-use-case-test', { id: 'TL-LEND-UC01-R01-T01', size: 'volume', smoke: true });
    expect(tl.workspace().records.find((r) => r.id === 'TL-LEND-UC01-R01-T01')?.fields).toMatchObject({ size: 'volume', smoke: true });
    expect(tl.refuse('use-case change-use-case-test', { id: 'TL-LEND-UC01-R01-T01', size: 'small' })).toContain('size');
    expect(tl.refuse('use-case change-use-case-test', { id: 'TL-LEND-UC01-R01-T01', external: false })).toContain('external');
  });

  it('LA-TRC-UC04-FL-T prove the rules of the patterns a domain follows', async () => {
    const tl = product();
    await tl.seed([...LENDING, ...SHOP, add('pattern', { id: 'TL-PAT-ACT', title: 'Librarian action', product_id: 'TL', description: 'An action a librarian takes that saves a record.' }), add('pattern_setting', { pattern_id: 'TL-PAT-ACT', position: 1, name: 'record', meaning: 'The record the action saves.' })]);
    // S01: the pattern's rules, each owed by every follower.
    tl.command('pattern add-pattern-rule', { id: 'TL-PAT-ACT-R01', title: 'A saved record reads the same', pattern_id: 'TL-PAT-ACT', statement: 'A record MUST read back as it was saved.' });
    tl.command('pattern add-pattern-rule', { id: 'TL-PAT-ACT-R02', title: 'The saved record is named', pattern_id: 'TL-PAT-ACT', statement: 'The action MUST name the record it saves.' });
    // S07: a pattern nobody follows is a warning.
    expect(problemsOf(tl.workspace(), 'pattern-not-followed')).toEqual([expect.stringMatching(/^TL-PAT-ACT: /)]);
    // S03: lending follows it as a domain; the shop through a use case, giving its setting a value.
    tl.command('pattern-following follow-pattern', { follower_id: 'TL-LEND', pattern_id: 'TL-PAT-ACT' });
    tl.command('pattern-following follow-pattern', { follower_id: 'TL-SHOP-UC01', pattern_id: 'TL-PAT-ACT', setting_values: [{ setting: 'record', value: 'Sale' }] });
    expect(problemsOf(tl.workspace(), 'pattern-not-followed')).toEqual([]);
    // S05, S06: each rule counts once in each domain that follows the pattern, which owes every rule.
    expect(coverage(tl, 'TL-LEND', 'pattern_rule')).toMatchObject({ total: 2, proved: 0, proof_only: true });
    expect(coverage(tl, 'TL-SHOP', 'pattern_rule')).toMatchObject({ total: 2, proved: 0 });
    expect(problemsOf(tl.workspace(), 'not-proved').filter((p) => p.startsWith('TL-PAT-ACT')).sort()).toEqual([
      expect.stringMatching(/^TL-PAT-ACT-R01: .*TL-LEND/),
      expect.stringMatching(/^TL-PAT-ACT-R01: .*TL-SHOP/),
      expect.stringMatching(/^TL-PAT-ACT-R02: .*TL-LEND/),
      expect.stringMatching(/^TL-PAT-ACT-R02: .*TL-SHOP/),
    ]);
    // S04: one pattern rule test per rule in each following domain, naming the domain.
    const tests = [['TL-PAT-ACT-R01-T01', 'TL-PAT-ACT-R01', 'TL-LEND'], ['TL-PAT-ACT-R01-T02', 'TL-PAT-ACT-R01', 'TL-SHOP'], ['TL-PAT-ACT-R02-T01', 'TL-PAT-ACT-R02', 'TL-LEND'], ['TL-PAT-ACT-R02-T02', 'TL-PAT-ACT-R02', 'TL-SHOP']];
    tl.write('test/actions.test.ts', tests.map(([id]) => `it('${id}');\n`).join(''));
    for (const [id, rule, domain] of tests) {
      tl.command('pattern add-pattern-rule-test', { id, title: `${rule} holds in ${domain}`, pattern_rule_id: rule, domain_id: domain, level: 'service', state: 'automated', file: 'test/actions.test.ts', when: 'A record is saved and read back', then: 'It reads the same' });
    }
    const out = tl.check().stdout;
    expect(line(out, 'TL-LEND', 'pattern rule')).toBe('TL-LEND pattern rule: proof only, 2/2 proved');
    expect(line(out, 'TL-SHOP', 'pattern rule')).toBe('TL-SHOP pattern rule: proof only, 2/2 proved');
    // S07: an obligation outside every domain counts in the product's Shared coverage.
    await tl.seed([
      add('value_object', { id: 'TL-VO01', title: 'Email address', description: 'Where a member gets mail.' }),
      add('entity_field', { entity_id: 'TL-LEND-EN01', position: 2, name: 'Borrower email', meaning: 'Where reminders go.', type_value_object_id: 'TL-VO01', required: true }),
      add('entity_field', { entity_id: 'TL-LEND-EN01', position: 3, name: 'Shop email', meaning: 'Where receipts go.', type_value_object_id: 'TL-VO01', required: false }),
      add('aggregate', { id: 'TL-SHOP-A1', title: 'Sale', domain_id: 'TL-SHOP', identity: 'Sale ID', description: 'One tool sold to one member.' }),
      add('entity', { id: 'TL-SHOP-EN01', title: 'Sale', aggregate_id: 'TL-SHOP-A1', role: 'root', description: 'The sale itself.' }),
      add('entity_field', { entity_id: 'TL-SHOP-EN01', position: 1, name: 'Buyer email', meaning: 'Where the receipt goes.', type_value_object_id: 'TL-VO01', required: true }),
      add('constraint', { id: 'TL-VO01-C01', title: 'One at sign', value_object_id: 'TL-VO01', statement: 'An email address MUST hold exactly one @.' }),
    ]);
    expect(coverage(tl, null, 'constraint')).toMatchObject({ total: 1 });
  });

  it('LA-TRC-UC05-FL-T check that each test\'s file names it', async () => {
    const tl = product();
    await tl.seed([...LENDING, add('uc_requirement', { id: 'TL-LEND-UC01-R02', title: 'A member in debt is refused', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse a member who owes a fee.' }), add('uc_requirement', { id: 'TL-LEND-UC01-R03', title: 'The due date is set', use_case_id: 'TL-LEND-UC01', statement: 'The loan MUST be due two weeks after it opens.' })]);
    // S01: the Agent writes the test's code, but names a longer ID, not the test's own.
    tl.write('test/loans.test.ts', "it('TL-LEND-UC01-R01-T011 a tool on loan is refused');\n");
    tl.command('use-case add-use-case-test', { id: 'TL-LEND-UC01-R01-T01', title: 'A tool on loan is refused', uc_requirement_id: 'TL-LEND-UC01-R01', level: 'service', state: 'automated', file: 'test/loans.test.ts', when: 'A member borrows a tool that is on loan', then: 'The loan is refused' });
    // S02, S03: the check reads the file for the whole ID, and a file that does not name its test is an error.
    const silent = tl.check();
    expect(silent.status).toBe(1);
    expect(silent.stdout).toMatch(/\[test-file-missing-id\] TL-LEND-UC01-R01-T01: [^\n]*test\/loans\.test\.ts/);
    tl.write('test/loans.test.ts', "it('TL-LEND-UC01-R01-T01 a tool on loan is refused');\n");
    expect(problemsOf(tl.workspace(), 'test-file-missing-id')).toEqual([]);
    // S04: a manual test's file and one not automated yet are checked only for existing.
    tl.write('docs/ledger.md', 'How the ledger is read.\n');
    tl.command('use-case add-use-case-test', { id: 'TL-LEND-UC01-R02-T01', title: 'A member in debt is refused', uc_requirement_id: 'TL-LEND-UC01-R02', level: 'browser', state: 'manual', manual_reason: 'Manual because the fee is read off the paper ledger.', file: 'docs/ledger.md', when: 'A member who owes a fee borrows a tool', then: 'The librarian refuses the loan' });
    tl.command('use-case add-use-case-test', { id: 'TL-LEND-UC01-R03-T01', title: 'The due date is set', uc_requirement_id: 'TL-LEND-UC01-R03', level: 'service', state: 'not automated yet', file: 'docs/ledger.md', when: 'A loan opens', then: 'It is due in two weeks' });
    const ws = tl.workspace();
    expect(ws.problems.filter((p) => p.severity === 'error')).toEqual([]);
    expect(problemsOf(ws, 'test-file-missing-id')).toEqual([]);
    expect(problemsOf(ws, 'test-file-missing')).toEqual([]);
    // S05, S06: the check reads each test case in the test files for a test of its file, and one that names none is an
    // error with its file and line until the Agent names it.
    tl.write('test/loans.test.ts', "it('TL-LEND-UC01-R01-T01 a tool on loan is refused');\nit('a tool is refused twice');\n");
    const unnamed = tl.check();
    expect(unnamed.status).toBe(1);
    expect(unnamed.stdout).toContain('[test-case-unnamed] test/loans.test.ts:2: the test case "a tool is refused twice" names no test whose file is test/loans.test.ts');
    tl.write('test/loans.test.ts', "it('TL-LEND-UC01-R01-T01 a tool on loan is refused');\nit('TL-LEND-UC01-R01-T01 a tool is refused twice');\n");
    expect(problemsOf(tl.workspace(), 'test-case-unnamed')).toEqual([]);
  });

  it('LA-TRC-UC06-FL-T see each domain\'s tests by state', async () => {
    const tl = product();
    await tl.seed([
      ...LENDING,
      add('uc_requirement', { id: 'TL-LEND-UC01-R02', title: 'A member in debt is refused', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse a member who owes a fee.' }),
      add('uc_requirement', { id: 'TL-LEND-UC01-R03', title: 'The due date is set', use_case_id: 'TL-LEND-UC01', statement: 'The loan MUST be due two weeks after it opens.' }),
      add('use_case_test', { id: 'TL-LEND-UC01-R01-T01', title: 'A tool on loan is refused', uc_requirement_id: 'TL-LEND-UC01-R01', level: 'service', state: 'automated', file: 'test/loans.test.ts', when: 'A member borrows a tool that is on loan', then: 'The loan is refused' }),
      add('use_case_test', { id: 'TL-LEND-UC01-R02-T01', title: 'A member in debt is refused', uc_requirement_id: 'TL-LEND-UC01-R02', level: 'browser', state: 'manual', manual_reason: 'Manual because the fee is read off the paper ledger.', when: 'A member who owes a fee borrows a tool', then: 'The librarian refuses the loan' }),
      add('use_case_test', { id: 'TL-LEND-UC01-R03-T01', title: 'The due date is set', uc_requirement_id: 'TL-LEND-UC01-R03', level: 'service', state: 'not automated yet', when: 'A loan opens', then: 'It is due in two weeks' }),
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

  it('LA-TRC-UC07-FL-T follow a pattern per domain', async () => {
    const tl = product();
    await tl.seed([
      ...LENDING,
      add('use_case', { id: 'TL-LEND-UC02', title: 'Renew a loan', capability_id: 'TL-LEND-CAP01', goal: 'A member keeps a tool longer.' }),
      ...PATTERN,
      add('pattern', { id: 'TL-PAT-LOG', title: 'Audit log', product_id: 'TL', description: 'Every change is written to a log.' }),
      add('pattern_rule', { id: 'TL-PAT-LOG-R01', title: 'Every change is logged', pattern_id: 'TL-PAT-LOG', statement: 'Each change MUST be written to the audit log.' }),
    ]);
    // S01: the Owner links the domain to a pattern with no settings.
    tl.command('pattern-following follow-pattern', { follower_id: 'TL-LEND', pattern_id: 'TL-PAT-LOG' });
    // S02: a use case follows the pattern with a setting, and gives its value.
    tl.command('pattern-following follow-pattern', { follower_id: 'TL-LEND-UC02', pattern_id: 'TL-PAT-ACT' });
    expect(problemsOf(tl.workspace(), 'pattern-setting-missing')).toEqual([expect.stringMatching(/^TL-LEND-UC02: /)]);
    tl.command('pattern-following change-setting-values', { follower_id: 'TL-LEND-UC02', pattern_id: 'TL-PAT-ACT', setting_values: [{ setting: 'record', value: 'Loan' }] });
    const ws = tl.workspace();
    expect(problemsOf(ws, 'pattern-setting-missing')).toEqual([]);
    // S03: each rule counts once in the domain, asking only for proof.
    expect(ws.coverage.find((c) => c.domain === 'TL-LEND')?.obligations.find((o) => o.kind === 'pattern_rule')).toMatchObject({ total: 2, proof_only: true, proved: 0 });
    expect(gapsOf(ws, 'TL-LEND').filter((g) => g.includes('TL-PAT-'))).toEqual(['proved TL-PAT-ACT-R01', 'proved TL-PAT-LOG-R01']);
    // S04: the use case that follows a pattern is not asked for requirements of its own.
    expect(gapsOf(ws, 'TL-LEND').filter((g) => g.startsWith('use-case-without-requirement'))).toEqual([]);
    // S05: a product kind declared an obligation is counted like Lathe's.
    tl.command('product declare-product-kind', { name: 'house_rule', product_id: 'TL', label: 'House rule', description: 'A rule of the house.', parent_kind: 'domain', stage: 'use-cases', obligation: true, complexity: 'essential' });
    tl.command('extension-record add-extension-record', { kind: 'house_rule', id: 'TL-LEND-HR01', parent_id: 'TL-LEND', values: { title: 'Quiet' } });
    expect(coverage(tl, 'TL-LEND', 'house_rule')).toMatchObject({ label: 'House rule', total: 1, proved: 0 });
    // S06: a product kind named like one of Lathe's tables is refused.
    expect(tl.refuse('product declare-product-kind', { name: 'invariant', product_id: 'TL', label: 'Our invariant', description: 'A rule of ours.', parent_kind: 'domain', stage: 'use-cases', obligation: true, complexity: 'essential' })).toContain('invariant');
  });

  it('LA-TRC-UC21-FL-T account for hand-written accidental complexity', async () => {
    const tl = product();
    await tl.seed([
      ...LENDING,
      ...PATTERN,
      add('slot', { id: 'TL-PAT-ACT-SL01', title: 'Refusal message', pattern_id: 'TL-PAT-ACT', statement: 'A fill MUST word the refusal for the librarian.' }),
      add('tooling', { id: 'TL-LEND-TOOL01', title: 'generate.ts', domain_id: 'TL-LEND', file: 'scripts/generate.ts' }),
      add('tooling', { id: 'TL-LEND-TOOL02', title: 'routes.generated.ts', domain_id: 'TL-LEND', file: 'src/routes.generated.ts' }),
      add('tooling', { id: 'TL-LEND-TOOL03', title: 'refusals.ts', domain_id: 'TL-LEND', file: 'src/refusals.ts' }),
      link('TL-LEND-TOOL01', 'generates', 'TL-LEND-TOOL02'),
      add('integration', { id: 'TL-INT01', title: 'Database host', system: 'Managed PostgreSQL', description: "The service that runs the library's database." }),
      add('data_store', { id: 'TL-STORE01', title: 'DATABASE_URL', product_id: 'TL', kind: 'database', description: "The library's database." }),
    ]);
    expect(problemsOf(tl.workspace(), 'accidental-not-accounted-for').filter((p) => p.startsWith('TL-STORE01:'))).toHaveLength(1);
    // S01: a record written by hand fills a slot of the pattern it is owed to.
    tl.command('slot-filling fill-slot', { record_id: 'TL-LEND-TOOL03', slot_id: 'TL-PAT-ACT-SL01' });
    // S02: what provides the data store is named.
    tl.command('provision name-provider', { record_id: 'TL-STORE01', provider_id: 'TL-INT01' });
    // S03: the provided record is accounted for, and the fill is debt at its slot.
    const ws = tl.workspace();
    expect(problemsOf(ws, 'accidental-not-accounted-for').filter((p) => p.startsWith('TL-STORE01:'))).toEqual([]);
    expect(ws.coverage.find((c) => c.domain === 'TL-LEND')?.debt).toContainEqual({ id: 'TL-LEND-TOOL03', slot: 'TL-PAT-ACT-SL01' });
    // S04: a fill of a record a generator writes is refused.
    expect(tl.refuse('slot-filling fill-slot', { record_id: 'TL-LEND-TOOL02', slot_id: 'TL-PAT-ACT-SL01' })).toContain('a fill is written by hand');
  });

  it('LA-TRC-UC08-FL-T report tests that count for nothing', async () => {
    const tl = product();
    await tl.seed([
      ...LENDING,
      ...SHOP,
      ...PATTERN,
      link('TL-LEND', 'follows', 'TL-PAT-ACT'),
      add('use_case_test', { id: 'TL-LEND-UC01-R01-T01', title: 'A tool on loan is refused', uc_requirement_id: 'TL-LEND-UC01-R01', level: 'browser', state: 'manual', manual_reason: 'Manual because the librarian checks the shelf.', file: 'docs/shelf.md', when: 'A member borrows a tool that is on loan', then: 'The loan is refused' }),
      add('pattern_rule_test', { id: 'TL-PAT-ACT-R01-T01', title: 'A saved record reads the same', pattern_rule_id: 'TL-PAT-ACT-R01', domain_id: 'TL-SHOP', level: 'service', state: 'automated', file: 'test/actions.test.ts', when: 'A sale is saved and read back', then: 'It reads the same' }),
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

  it('LA-TRC-UC20-FL-T see the outcomes each record serves', async () => {
    const tl = product();
    await tl.seed([
      ...LENDING,
      ...DESIGNED,
      add('business_outcome', { id: 'TL-BO01', title: 'More tools in use', product_id: 'TL', statement: 'Members borrow the library\'s tools more often.', measure: 'Loans opened per tool per month.', target: 'Two per tool per month within a year of opening.', measured_outside: 'The librarian counts loans each month.' }),
      link('TL-LEND-CAP01', 'serves', 'TL-BO01'),
      // An aggregate no step reaches.
      add('aggregate', { id: 'TL-LEND-A2', title: 'Fee', domain_id: 'TL-LEND', identity: 'Fee ID', description: 'A fee a member owes.' }),
    ]);
    // S01: a record's outcomes, and the use cases it serves them through.
    expect(tl.run('serves', 'get-serves', '--id', 'TL-LEND-A1').trim()).toBe('TL-LEND-A1 serves TL-BO01 through TL-LEND-UC01');
    expect(tl.run('serves', 'get-serves', '--id', 'TL-LEND-A2').trim()).toBe('TL-LEND-A2 serves no outcome');
    // S02: the product's records with their outcomes, and those serving none.
    const listed = tl.run('serves', 'list-serves', '--product_id', 'TL');
    expect(listed).toContain('  TL-LEND-A1: TL-BO01\n');
    expect(listed).toContain('  Serves no outcome: TL-LEND-A2');
    // S03: the check warns of each, saying how to fix it, and still passes.
    const result = tl.check();
    expect(result.status).toBe(0);
    expect(problemsOf(tl.workspace(), 'serves-no-outcome')).toEqual([
      'TL-LEND-A2: Aggregate TL-LEND-A2 serves no outcome: no use case whose capability serves a business outcome reaches it. Write the use case that needs it, or remove it.',
    ]);
  });
});
