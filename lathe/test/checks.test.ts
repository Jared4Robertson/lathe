// Lathe's checks, one at a time: each starts from the complete product, which gives no problem, and changes one
// thing to break the rule.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openStore, LATHE_DATA_DIR, type Workspace } from '../src/index.ts';
import path from 'node:path';
import { checkText } from '../src/cli/operations.ts';
import { adding, changing, complete, gaps, loadData, ofCheck, records, refusals, removeData, without } from './helpers.ts';

afterAll(removeData);

let clean: Workspace;
beforeAll(async () => {
  clean = await loadData(complete());
});

describe("Lathe's checks", () => {
  it('LA-STD-CODE-R05-T01 the complete product breaks none of them', () => {
    expect(clean.problems).toEqual([]);
  });

  it('LA-STD-CODE-R05-T01 every check row has a test here', async () => {
    const store = await openStore(path.dirname(LATHE_DATA_DIR), { latheDataDir: null });
    const names = store.rows('check').map((r) => String(r.name)).sort();
    await store.close();
    const tested = describedChecks.sort();
    expect(names).toEqual(tested);
  });

  it('LA-CHK-UC01-R06-T01 every problem names its check and, when it has one, its record', async () => {
    let data = without(complete(), 'happens_in', () => true);
    data = changing(data, 'specification_test', () => true, { state: 'not automated yet' });
    const ws = await loadData(data, { silent: ['EX-LEND-INV01-T'], missing: ['src/dates.ts'] });
    expect(new Set(ws.problems.map((p) => p.check)).size).toBeGreaterThan(3);
    for (const problem of ws.problems) {
      expect(problem.check).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(problem.message, problem.check).toMatch(/\.$/);
      if (problem.record !== null) expect(problem.message, problem.check).toContain(problem.record);
    }
  });
});

/** The checks this file tests, one describe each. */
const describedChecks: string[] = [];
const check = (name: string, body: () => void) => {
  describedChecks.push(name);
  describe(name, body);
};

check('table-schema-mismatch', () => {
  it('LA-TRC-UC16-R01-T02 a table kept in a database whose file leaves out a column is a warning', async () => {
    const ws = await loadData(complete(), { files: { 'src/schema.sql': 'CREATE TABLE loans (id INTEGER PRIMARY KEY);\nCREATE TABLE tools (id INTEGER PRIMARY KEY);\n' } });
    const found = ofCheck(ws, 'table-schema-mismatch');
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((p) => p.severity === 'warning' && p.message.includes('names src/schema.sql, which'))).toBe(true);
    expect(records(found).filter((r, i, all) => all.indexOf(r) === i)).toEqual(['EX-LEND-EN01-TB', 'EX-LEND-EN03-TB', 'EX-LEND-RM01-TB']);
  });
});

check('test-file-missing', () => {
  it("LA-TRC-UC05-R05-T01 an automated or manual test's missing file is an error; one not automated yet is a warning", async () => {
    let data = changing(complete(), 'integration_test', () => true, { file: 'manual/mail.md' });
    data = changing(data, 'domain_service_test', () => true, { state: 'not automated yet', file: 'test/later.test.ts' });
    const ws = await loadData(data, { missing: ['test/email.test.ts', 'manual/mail.md', 'test/later.test.ts'] });
    expect(ofCheck(ws, 'test-file-missing').map((p) => [p.severity, p.record])).toEqual([
      ['error', 'EX-INT01-T01'],
      ['warning', 'EX-LEND-DS01-T01'],
      ['error', 'EX-VO01-C01-T'],
    ]);
    expect(ofCheck(ws, 'test-file-missing')[2].message).toBe('Constraint test EX-VO01-C01-T names the file test/email.test.ts, which does not exist.');
  });

  it('LA-TRC-UC03-R03-T01 only an automated test needs a file and only a manual test gives a reason; a test not automated yet may name a file to come', async () => {
    const test = (changes: Record<string, string | undefined>) => changing(complete(), 'use_case_test', (r) => r.id === 'EX-LEND-UC01-R01-T01', changes);
    const refused = async (changes: Record<string, string | undefined>) => (await refusals(test(changes))).map((p) => p.rule);
    expect(await refused({ file: undefined })).toEqual(['check']);
    expect(await refused({ state: 'manual', level: 'manual', file: undefined })).toEqual(['check']);
    expect(await refused({ manual_reason: 'Looked at by eye.' })).toEqual(['check']);
    expect(await refused({ state: 'not automated yet', file: undefined })).toEqual([]);
    expect(await refused({ state: 'manual', level: 'manual', file: undefined, manual_reason: 'Looked at by eye.' })).toEqual([]);
    const later = await loadData(test({ state: 'not automated yet', file: 'test/later.test.ts' }), { missing: ['test/later.test.ts'] });
    expect(ofCheck(later, 'test-file-missing').map((p) => [p.severity, p.record])).toEqual([['warning', 'EX-LEND-UC01-R01-T01']]);
    expect(later.problems.filter((p) => p.severity === 'error')).toEqual([]);
  });

  it('LA-AUT-INV21-T a folder is not a test file', async () => {
    const ws = await loadData(changing(complete(), 'policy_test', () => true, { file: 'src' }), { missing: ['src'] });
    expect(records(ofCheck(ws, 'test-file-missing'))).toEqual(['EX-LEND-PO01-T']);
  });
});

check('test-file-missing-id', () => {
  it('LA-AUT-INV21-T an automated test whose file does not name it is an error', async () => {
    const ws = await loadData(complete(), { silent: ['EX-LEND-INV01-T'] });
    expect(ofCheck(ws, 'test-file-missing-id')).toEqual([
      expect.objectContaining({ severity: 'error', record: 'EX-LEND-INV01-T', message: expect.stringContaining('does not mention EX-LEND-INV01-T') }),
    ]);
  });

  it('LA-TRC-UC03-R01-T01 an automated test whose file does not name it proves nothing', async () => {
    const ws = await loadData(complete(), { silent: ['EX-LEND-INV01-T'] });
    expect(gaps(ws)).toEqual(['proved EX-LEND-INV01']);
    expect(gaps(clean)).toEqual([]);
  });

  it('LA-TRC-UC05-R01-T03 a test file names an ID only as a whole ID', async () => {
    const files = { 'test/loans.test.ts': "it('EX-LEND-INV01-T2 is another test', () => {});\nit('EX-LEND-SP01-T ok');\nit('EX-LEND-PO01-T ok');\n" };
    const ws = await loadData(complete(), { files });
    expect(records(ofCheck(ws, 'test-file-missing-id'))).toEqual(['EX-LEND-INV01-T']);
  });
  it('LA-TRC-DS01-T01 an ID is found only as a whole ID, never inside a longer one or as the start of a child ID', async () => {
    const file = (text: string) => ({ files: { 'test/loans.test.ts': `${text}\nit('EX-LEND-SP01-T ok');\nit('EX-LEND-PO01-T ok');\n` } });
    const named = async (text: string) => records(ofCheck(await loadData(complete(), file(text)), 'test-file-missing-id')).length === 0;
    expect(await named("it('EX-LEND-INV01-T refuses a second loan')")).toBe(true);
    expect(await named('// (EX-LEND-INV01-T), at the end of a line: EX-LEND-INV01-T')).toBe(true);
    expect(await named("it('EX-LEND-INV01-T2 is another test')")).toBe(false);
    expect(await named("it('EX-LEND-INV01-T-B is a child')")).toBe(false);
    expect(await named("it('XEX-LEND-INV01-T is another prefix')")).toBe(false);
    expect(await named("it('PRE-EX-LEND-INV01-T is longer')")).toBe(false);
  });

  it("LA-TRC-UC05-R06-T01 a product kind's record that proves an obligation has its file checked as a test's", async () => {
    const data = adding(complete(), {
      product_kind: [
        { name: 'house_rule', product_id: 'EX', label: 'House rule', description: 'A rule of the house.', parent_kind: 'domain', stage: 'use-cases', obligation: true },
        { name: 'script', product_id: 'EX', label: 'Script', description: 'A script.', parent_kind: 'domain', stage: 'technical-specification', obligation: false },
        { name: 'rule_check', product_id: 'EX', label: 'Rule check', description: 'A script that checks a rule.', parent_kind: 'domain', stage: 'test-plan', obligation: false },
      ],
      product_kind_field: [
        { kind: 'script', position: 1, name: 'file', type: 'text', required: true, description: 'The file.' },
        { kind: 'rule_check', position: 1, name: 'file', type: 'text', required: true, description: 'The file that runs it.' },
      ],
      product_relation: [
        { name: 'enforces', source_kind: 'script', target_kind: 'house_rule', product_id: 'EX', role: 'design', forward_label: 'Enforces', reverse_label: 'Enforced by', description: 'The script enforces the rule.' },
        { name: 'checks_by_script', source_kind: 'rule_check', target_kind: 'house_rule', product_id: 'EX', role: 'proof', forward_label: 'Checks', reverse_label: 'Checked by', description: 'The script checks the rule.' },
      ],
      house_rule: [{ id: 'EX-LEND-HR01', title: 'Quiet', domain_id: 'EX-LEND' }],
      script: [{ id: 'EX-LEND-SC01', title: 'quiet.sh', domain_id: 'EX-LEND', file: 'bin/quiet.sh' }],
      rule_check: [{ id: 'EX-LEND-RC01', title: 'quiet-check.sh', domain_id: 'EX-LEND', file: 'test/quiet-check.sh' }],
      enforces: [{ source_id: 'EX-LEND-SC01', target_id: 'EX-LEND-HR01' }],
      checks_by_script: [{ source_id: 'EX-LEND-RC01', target_id: 'EX-LEND-HR01' }],
    });
    const found = (ws: Workspace, name: string) => ofCheck(ws, name).map((p) => [p.severity, p.record]);
    const clean = await loadData(data);
    expect([...found(clean, 'test-file-missing'), ...found(clean, 'test-file-missing-id')]).toEqual([]);
    // Neither file is written: only the rule check, which proves the rule, is a test whose file is missing.
    const missing = await loadData(data, { missing: ['bin/quiet.sh', 'test/quiet-check.sh'] });
    expect(found(missing, 'test-file-missing')).toEqual([['error', 'EX-LEND-RC01']]);
    expect(ofCheck(missing, 'test-file-missing')[0].message).toBe('Rule check EX-LEND-RC01 names the file test/quiet-check.sh, which does not exist.');
    // Both files leave their IDs out: again only the rule check is reported.
    const silent = await loadData(data, { silent: ['EX-LEND-SC01', 'EX-LEND-RC01'] });
    expect(found(silent, 'test-file-missing-id')).toEqual([['error', 'EX-LEND-RC01']]);
  });
});

check('test-case-unnamed', () => {
  const unnamed = (ws: Workspace) => ofCheck(ws, 'test-case-unnamed').map((p) => [p.severity, p.record, p.message.split(': the test case ')[0]]);

  it('LA-TRC-UC05-R07-T01 a test case naming no test whose file it is in is an error; one named in its describe or each rows is not', async () => {
    const api = [
      "import { describe, it } from 'vitest';",
      "it('EX-LEND-UC01-R01-T01 a lent tool is refused', () => {});",
      "describe('EX-LEND-UC02-R01-T01 a nameless tool', () => {",
      "  it('is refused', () => {});",
      "  describe.each([1, 2])('with %s spaces', () => { it.skip('is refused too', () => {}); });",
      '});',
      "it.each(['EX-LEND-EP01-R01-T01', 'EX-PAT-ACT-R01-T01'])('%s answers', () => {});",
      "it('proves something nobody can find', () => {});",
      "it('EX-V01-R01-T01 names a test of another file', () => {});",
      "const fixture = \"it('a test written inside a string', () => {})\"; // it('nor in a comment')",
      'const tagged = `',
      "  test('nor inside a template literal')",
      '`;',
      "test.each`a | b`('a table each with no ID', () => {});",
      '',
    ].join('\n');
    const spec = [
      "import { test } from '@playwright/test';",
      "test.describe('the catalog', () => {",
      "  test.beforeEach(async () => {});",
      "  test('EX-V01-R01-T01 free tools come first', async () => { await test.step('opens the page', async () => {}); });",
      "  test.skip('a skipped Playwright test with no ID', async () => {});",
      '});',
      '',
    ].join('\n');
    const ws = await loadData(complete(), { files: { 'test/api.test.ts': api, 'e2e/catalog.spec.ts': spec } });
    expect(unnamed(ws)).toEqual([
      ['error', null, 'e2e/catalog.spec.ts:5'],
      ['error', null, 'test/api.test.ts:8'],
      ['error', null, 'test/api.test.ts:9'],
      ['error', null, 'test/api.test.ts:14'],
    ]);
    expect(ofCheck(ws, 'test-case-unnamed')[1].message).toBe(
      'test/api.test.ts:8: the test case "proves something nobody can find" names no test whose file is test/api.test.ts; start its name, or its describe\'s, with the ID of the test it proves, or remove it if it proves nothing.',
    );
    expect(ofCheck(ws, 'test-case-unnamed')[0].message).toContain('"the catalog > a skipped Playwright test with no ID"');
    // The complete product's test files hold no test cases, so none is unnamed.
    expect(ofCheck(clean, 'test-case-unnamed')).toEqual([]);
  });

  it('LA-TRC-UC05-R07-T02 a file a test names is read for test cases, whatever its name', async () => {
    const data = changing(complete(), 'standard_rule_test', () => true, { file: 'checks/imports.ts' });
    const ws = await loadData(data, { files: { 'checks/imports.ts': "// EX-STD-CODE-R01-T01\nit('EX-STD-CODE-R01-T01 no bare import', () => {});\ntest('an import check with no ID', () => {});\n" } });
    expect(unnamed(ws)).toEqual([['error', null, 'checks/imports.ts:3']]);
  });
});

check('manual-test-file-silent', () => {
  it('LA-TRC-UC08-R03-T01 a manual test whose file exists but never names it is a warning', async () => {
    const data = changing(complete(), 'integration_test', () => true, { file: 'manual/mail.md' });
    const ws = await loadData(data, { files: { 'manual/mail.md': 'Send a mail and look for it.\n' } });
    expect(ofCheck(ws, 'manual-test-file-silent')).toEqual([expect.objectContaining({ severity: 'warning', record: 'EX-INT01-T01' })]);
    expect(ofCheck(await loadData(data), 'manual-test-file-silent')).toEqual([]);
  });
});

check('test-level-not-allowed', () => {
  it('LA-CHK-UC04-R04-T01 a test at a level its kind does not allow is a warning naming the allowed levels', async () => {
    let data = changing(complete(), 'constraint_test', () => true, { level: 'api' });
    data = changing(data, 'flow_test', (r) => r.id === 'EX-LEND-UC01-FL01-T', { level: 'api' });
    const ws = await loadData(data);
    expect(ofCheck(ws, 'test-level-not-allowed').map((p) => p.message)).toEqual([
      'Flow test EX-LEND-UC01-FL01-T runs at level api, which a flow test does not allow; run it at e2e-api, e2e-ui, manual.',
      'Constraint test EX-VO01-C01-T runs at level api, which a constraint test does not allow; run it at database, unit.',
    ]);
    // A constraint enforced by a SQL CHECK is tested at database level, which a constraint test allows.
    expect(ofCheck(await loadData(changing(complete(), 'constraint_test', () => true, { level: 'database' })), 'test-level-not-allowed')).toEqual([]);
  });

  it('LA-CHK-UC04-R04-T02 a pattern rule test may run at any level', async () => {
    for (const level of ['unit', 'database', 'contract', 'e2e-api', 'e2e-ui']) {
      const ws = await loadData(changing(complete(), 'pattern_rule_test', () => true, { level }));
      expect(ofCheck(ws, 'test-level-not-allowed'), level).toEqual([]);
    }
  });
});

check('technical-file-missing', () => {
  it('LA-AUT-UC17-R07-T02 a technical record whose file does not exist is a warning; a folder will do', async () => {
    let data = changing(complete(), 'adapter', () => true, { file: 'src/mail' });
    data = changing(data, 'ui_component', () => true, { file: 'src' });
    const ws = await loadData(data, { missing: ['src/dates.ts', 'src/mail', 'src'] });
    expect(ofCheck(ws, 'technical-file-missing')).toEqual([
      expect.objectContaining({ severity: 'warning', record: 'EX-INT01-AD', message: 'Adapter EX-INT01-AD names src/mail, which does not exist yet.' }),
      expect.objectContaining({ severity: 'warning', record: 'EX-LEND-DS01-SV' }),
    ]);
  });
});

check('package-not-in-manifest', () => {
  it('LA-TRC-UC19-R02-T02 a record that names a package no package.json lists is an error; one a manifest lists is not', async () => {
    const data = adding(complete(), { package_use: [{ record_id: 'EX-INT01-AD', package: 'nodemailer' }, { record_id: 'EX-INT01-AD', package: 'left-pad' }] });
    const ws = await loadData(data, { files: { 'package.json': '{ "dependencies": { "nodemailer": "^7.0.0" } }\n' } });
    expect(ofCheck(ws, 'package-not-in-manifest')).toEqual([
      { severity: 'error', check: 'package-not-in-manifest', record: 'EX-INT01-AD', message: 'Adapter EX-INT01-AD names package left-pad, which no package.json of its product lists.' },
    ]);
  });
});

check('test-data-set-file-missing', () => {
  it('LA-AUT-UC13-R09-T01 a test data set no test starts from is an error; one whose file does not exist is an error when an automated test starts from it, else a warning; a folder will do', async () => {
    const unused = await loadData(without(complete(), 'starts_from', () => true));
    expect(ofCheck(unused, 'test-data-set-unused').map((p) => [p.severity, p.record])).toEqual([['error', 'EX-LEND-TD01']]);
    const missing = await loadData(complete(), { missing: ['test/seed.ts'] });
    expect(ofCheck(missing, 'test-data-set-file-missing')).toEqual([
      { severity: 'error', check: 'test-data-set-file-missing', record: 'EX-LEND-TD01', message: 'Test data set EX-LEND-TD01 names test/seed.ts, which does not exist, so the automated tests that start from it cannot run.' },
    ]);
    // Only a test not automated yet starts from it: the seed may be named before it is written.
    const later = changing(complete(), 'invariant_test', () => true, { state: 'not automated yet' });
    expect(ofCheck(await loadData(later, { missing: ['test/seed.ts'] }), 'test-data-set-file-missing')).toEqual([
      expect.objectContaining({ severity: 'warning', record: 'EX-LEND-TD01', message: 'Test data set EX-LEND-TD01 names test/seed.ts, which does not exist yet.' }),
    ]);
    // A folder of fixtures is a file that exists, and a data set is not a technical record.
    const folder = await loadData(changing(complete(), 'test_data_set', () => true, { file: 'fixtures' }), { missing: ['fixtures'], files: { 'fixtures/loans.json': '[]\n' } });
    expect(folder.problems).toEqual([]);
  });
});

describe('nothing uses it', () => {
  let ws: Workspace;
  beforeAll(async () => {
    let data = without(complete(), 'happens_in', () => true);
    data = without(data, 'exchanges_with', () => true);
    data = without(data, 'checks', () => true);
    data = without(data, 'renders', () => true);
    data = without(data, 'starts_from', () => true);
    data = changing(data, 'entity_field', (r) => r.type_value_object_id === 'EX-VO01', { type_value_object_id: undefined, type: 'text' });
    ws = await loadData(data);
  });
  const unused: [string, string, string][] = [
    ['view-unused', 'EX-V01', 'View EX-V01 is used by nothing: flow steps happen in it; link the steps that happen in it with happens_in, or remove it.'],
    ['integration-unused', 'EX-INT01', 'Integration EX-INT01 is used by nothing: flow steps exchange with it; link the steps that exchange with it with exchanges_with, or remove it.'],
    ['value-object-unused', 'EX-VO01', 'Value object EX-VO01 is used by nothing: fields of entities, value objects, events or read models are typed with it; type the fields that hold it with it, or remove it.'],
    ['specification-unused', 'EX-LEND-SP01', 'Specification EX-LEND-SP01 is used by nothing: commands check it and queries select by it; link the commands that check it or the queries that select by it, or remove it.'],
    ['test-data-set-unused', 'EX-LEND-TD01', 'Test data set EX-LEND-TD01 is used by nothing: tests start from it; link the tests that start from it with starts_from, or remove it.'],
    ['ui-component-unused', 'EX-UI01', 'UI component EX-UI01 is used by nothing: it renders views; link the views it renders with renders, or remove it.'],
  ];
  for (const [name, record, message] of unused) {
    check(name, () => {
      it(`LA-CHK-UC04-R09-T01 a record that nothing uses is a ${name} error`, () => {
        expect(ofCheck(ws, name)).toEqual([{ severity: 'error', check: name, record, message }]);
      });
    });
  }

  it('LA-CHK-UC04-R09-T02 a value object used by a read model is used; a query selecting by a specification uses it', async () => {
    let data = changing(complete(), 'entity_field', (r) => r.type_value_object_id === 'EX-VO01', { type_value_object_id: undefined, type: 'text' });
    data = adding(data, { read_model_field: [{ read_model_id: 'EX-LEND-RM01', position: 2, name: 'Email', meaning: 'Whom to tell.', type_value_object_id: 'EX-VO01', required: false }] });
    data = without(data, 'checks', () => true);
    data = adding(data, { selects_by: [{ source_id: 'EX-LEND-QRY01', target_id: 'EX-LEND-SP01' }] });
    const used = await loadData(data);
    expect(used.problems.filter((p) => p.check.endsWith('-unused'))).toEqual([]);
  });
});

describe('coverage gaps as warnings', () => {
  let ws: Workspace;
  beforeAll(async () => {
    let data = without(complete(), 'fulfills', (r) => r.source_id === 'EX-LEND-UC02-FL01-S01');
    data = changing(data, 'specification_test', () => true, { state: 'not automated yet' });
    ws = await loadData(data, { missing: ['src/dates.ts'] });
  });
  const mirrors = (name: string, missing: string) =>
    check(name, () => {
      it(`LA-TRC-UC01-R03-T01 names exactly the obligations coverage lists as not ${missing}, as warnings`, () => {
        const listed = ws.coverage.flatMap((c) => c.gaps.filter((g) => g.missing === missing).map((g) => ({ severity: 'warning', check: name, record: g.id, message: g.message })));
        expect(listed.length).toBeGreaterThan(0);
        expect(ofCheck(ws, name)).toEqual(listed);
      });
    });
  mirrors('not-designed', 'designed');
  mirrors('not-built', 'built');
  mirrors('not-proved', 'proved');

  it('LA-TRC-UC01-R02-T01 they say which obligation lacks what', () => {
    expect(ofCheck(ws, 'not-designed').map((p) => p.message)).toEqual(['UC requirement EX-LEND-UC02-R01 is not designed yet: no step of EX-LEND-UC02-FL01 fulfills it.']);
    expect(ofCheck(ws, 'not-built').map((p) => p.record)).toEqual(['EX-LEND-DS01']);
    expect(ofCheck(ws, 'not-proved').map((p) => p.message)).toEqual(['Specification EX-LEND-SP01 is not proved yet: its test is not automated yet.']);
  });
});

check('pattern-rule-test-outside-followers', () => {
  it('LA-TRC-UC08-R02-T01 a pattern rule test naming a domain that does not follow the pattern is an error; one where the rule is waived is a warning', async () => {
    let data = adding(complete(), { domain: [{ id: 'EX-SHOP', title: 'Shop', product_id: 'EX', subdomain_type: 'supporting' }] });
    data = adding(data, { pattern_rule_test: [{ id: 'EX-PAT-ACT-R01-T02', title: 'In the shop', pattern_rule_id: 'EX-PAT-ACT-R01', domain_id: 'EX-SHOP', level: 'api', state: 'not automated yet' }] });
    const ws = await loadData(data);
    expect(ofCheck(ws, 'pattern-rule-test-outside-followers')).toEqual([
      expect.objectContaining({ severity: 'error', record: 'EX-PAT-ACT-R01-T02', message: expect.stringContaining('which does not follow pattern EX-PAT-ACT') }),
    ]);
    // Once the domain follows the pattern itself, the test is in place.
    const following = adding(data, { follows: [{ source_id: 'EX-SHOP', target_id: 'EX-PAT-ACT' }] });
    expect(ofCheck(await loadData(following), 'pattern-rule-test-outside-followers')).toEqual([]);
    // A rule waived in a following domain: its test there counts for nothing.
    const waived = changing(complete(), 'pattern_rule', () => true, { applies_when_setting: 'record', applies_when_value: 'Loan', applies_when_negated: false });
    expect(ofCheck(await loadData(waived), 'pattern-rule-test-outside-followers')).toEqual([
      expect.objectContaining({ severity: 'warning', record: 'EX-PAT-ACT-R01-T01', message: expect.stringContaining('where the rule is not applicable or waived') }),
    ]);
  });
});

check('pattern-setting-missing', () => {
  it("LA-TRC-INV04-T a use case that answers each setting of its pattern is in place; one that gives no value for a setting is an error naming it", async () => {
    expect(ofCheck(clean, 'pattern-setting-missing')).toEqual([]);
    const ws = await loadData(without(complete(), 'setting_value', () => true));
    expect(ofCheck(ws, 'pattern-setting-missing')).toEqual([
      expect.objectContaining({ severity: 'error', record: 'EX-LEND-UC02', message: expect.stringContaining('setting "record"') }),
    ]);
  });
});

check('pattern-not-followed', () => {
  it('LA-TRC-UC04-R07-T01 a pattern no use case or domain follows is a warning', async () => {
    const data = without(without(complete(), 'setting_value', () => true), 'follows', () => true);
    const ws = await loadData(without(data, 'pattern_rule_test', () => true));
    expect(ofCheck(ws, 'pattern-not-followed')).toEqual([
      { severity: 'warning', check: 'pattern-not-followed', record: 'EX-PAT-ACT', message: "No use case or domain follows pattern EX-PAT-ACT, so its 1 rule is not counted in any domain's coverage." },
    ]);
  });
});

// A recorded exception is no check's problem: the workspace lists it apart, and the check's text prints it.
describe('recorded exceptions', () => {
  describe('LA-STD-PRINCIPLES-R03-T01 deviations are deliberate and visible', () => {
    it("LA-CHK-UC04-R12-T01 a command's recorded exceptions are listed with their command, aggregate and reason, never as warnings", async () => {
      const reason = 'The tool must never show as free while lent.';
      const ws = await loadData(adding(complete(), { command_change: [{ command_id: 'EX-LEND-CMD01', aggregate_id: 'EX-LEND-A2', reason }] }));
      expect(ws.exceptions).toEqual([{ command: 'EX-LEND-CMD01', aggregate: 'EX-LEND-A2', reason }]);
      expect(ws.problems).toEqual([]);
      expect(clean.exceptions).toEqual([]);
      const text = checkText({ errors: 0, warnings: 0, problems: [], exceptions: ws.exceptions });
      expect(text).toBe(`Recorded exceptions (1):\n  EX-LEND-CMD01 also changes aggregate EX-LEND-A2 in the same transaction: ${reason}\n\n0 errors, 0 warnings.`);
      expect(checkText({ errors: 0, warnings: 0, problems: [], exceptions: [] })).not.toContain('Recorded exceptions');
    });
  });
});

check('event-not-by-outbox', () => {
  it('LA-CHK-UC04-R13-T01 an event a policy hears not delivered by outbox is a warning; one that only feeds read models, published or not, may go in process', async () => {
    let data = changing(complete(), 'event_type', (r) => r.id === 'EX-LEND-EV01-ET', { delivery: 'in process' });
    data = changing(data, 'domain_event', (r) => r.id === 'EX-LEND-EV02', { published: true });
    data = adding(data, { fed_by: [{ source_id: 'EX-LEND-RM01', target_id: 'EX-LEND-EV02' }] });
    const ws = await loadData(data);
    expect(ofCheck(ws, 'event-not-by-outbox').map((p) => p.message)).toEqual([
      'Domain event EX-LEND-EV01 is heard by policy EX-LEND-PO01, but its event type EX-LEND-EV01-ET is delivered in process; deliver it by outbox.',
    ]);
  });

  it('LA-CHK-UC04-R13-T01 an event a policy hears with no event type, or whose event type gives no delivery, is reported too', async () => {
    const untyped = without(complete(), 'event_type', (r) => r.id === 'EX-LEND-EV01-ET');
    expect(ofCheck(await loadData(untyped), 'event-not-by-outbox').map((p) => p.message)).toEqual([
      'Domain event EX-LEND-EV01 is heard by policy EX-LEND-PO01, but has no event type; give it one delivered by outbox.',
    ]);
    const undelivered = changing(complete(), 'event_type', () => true, { delivery: undefined });
    expect(ofCheck(await loadData(undelivered), 'event-not-by-outbox').map((p) => p.message)).toEqual([
      'Domain event EX-LEND-EV01 is heard by policy EX-LEND-PO01, but its event type EX-LEND-EV01-ET gives no delivery; deliver it by outbox.',
    ]);
  });

  it('LA-CHK-UC04-R13-T01 an event a policy hears whose aggregate is in no database table, such as one kept in browser storage, a file or in memory, is exempt', async () => {
    let data = changing(complete(), 'event_type', (r) => r.id === 'EX-LEND-EV01-ET', { delivery: 'in process' });
    data = without(data, 'table_key', (r) => r.table_id === 'EX-LEND-EN01-TB' || r.target_table_id === 'EX-LEND-EN01-TB');
    expect(ofCheck(await loadData(without(data, 'table', (r) => r.id === 'EX-LEND-EN01-TB')), 'event-not-by-outbox')).toEqual([]);
    for (const storage of ['browser storage', 'file', 'in memory']) {
      const kept = changing(data, 'table', (r) => r.id === 'EX-LEND-EN01-TB', { storage });
      expect(ofCheck(await loadData(kept), 'event-not-by-outbox'), storage).toEqual([]);
    }
  });
});

check('has-crosses-aggregate', () => {
  it('LA-AUT-INV25-T has_one or has_many to an entity of another aggregate is an error', async () => {
    const ws = await loadData(adding(complete(), { has_many: [{ source_id: 'EX-LEND-EN01', target_id: 'EX-LEND-EN03' }] }));
    expect(ofCheck(ws, 'has-crosses-aggregate')).toEqual([
      expect.objectContaining({ severity: 'error', record: 'EX-LEND-EN01', message: expect.stringContaining('by a field typed by it') }),
    ]);
  });
});

check('entity-unreferenced', () => {
  it("LA-AUT-INV28-T a child entity its root does not reach by has_one or has_many is a warning", async () => {
    const ws = await loadData(without(complete(), 'has_one', () => true));
    expect(ofCheck(ws, 'entity-unreferenced')).toEqual([expect.objectContaining({ severity: 'warning', record: 'EX-LEND-EN02' })]);
  });
});

check('event-tense', () => {
  it('LA-AUT-INV27-T a title with no past form as its last word or after its first is a warning', async () => {
    const data = adding(complete(), {
      domain_event: [
        { id: 'EX-LEND-EV03', title: 'Return tool', aggregate_id: 'EX-LEND-A1', published: false },
        { id: 'EX-LEND-EV04', title: 'Loan became overdue', aggregate_id: 'EX-LEND-A1', published: false },
        { id: 'EX-LEND-EV05', title: 'Fee needed', aggregate_id: 'EX-LEND-A1', published: false },
        { id: 'EX-LEND-EV06', title: 'Speed', aggregate_id: 'EX-LEND-A1', published: false },
      ],
    });
    expect(records(ofCheck(await loadData(data), 'event-tense'))).toEqual(['EX-LEND-EV03', 'EX-LEND-EV06']);
  });
});

check('domain-named-for-technology', () => {
  it('LA-AUT-INV26-T a domain whose title or code names a technology is a warning; one only described so is not', async () => {
    const data = adding(complete(), {
      domain: [
        { id: 'EX-WEB', title: 'Web app', product_id: 'EX', subdomain_type: 'generic' },
        { id: 'EX-DB', title: 'Records', product_id: 'EX', subdomain_type: 'generic' },
        { id: 'EX-SHOP', title: 'Shop', product_id: 'EX', subdomain_type: 'generic', description: 'Served by its own server.' },
        { id: 'EX-TOUR', title: 'Guided tours', product_id: 'EX', subdomain_type: 'generic' },
      ],
    });
    const found = ofCheck(await loadData(data), 'domain-named-for-technology');
    expect(records(found)).toEqual(['EX-DB', 'EX-WEB']);
    expect(found.find((p) => p.record === 'EX-DB')?.message).toContain('its code DB says "db"');
  });
});

check('step-order', () => {
  it('LA-AUT-INV18-T a path whose positions skip a number is reported once, on the first step after the gap', async () => {
    const data = adding(complete(), {
      flow_step: [
        { id: 'EX-LEND-UC01-FL01-S03', title: 'Refused', flow_id: 'EX-LEND-UC01-FL01', path: 'refused', position: 2 },
        { id: 'EX-LEND-UC01-FL01-S04', title: 'Told why', flow_id: 'EX-LEND-UC01-FL01', path: 'Refused', position: 3 },
      ],
    });
    expect(ofCheck(await loadData(data), 'step-order')).toEqual([
      {
        severity: 'error', check: 'step-order', record: 'EX-LEND-UC01-FL01-S03',
        message: 'Flow step EX-LEND-UC01-FL01-S03 has position 2 on path refused in flow EX-LEND-UC01-FL01, but no step of that path has position 1; number the steps of a path 1, 2, 3 and so on, with no gaps.',
      },
    ]);
  });
});

// The complete product's interface made an API: its steps happen in no view.
const throughApi = () => changing(without(complete(), 'happens_in', () => true), 'interface', () => true, { kind: 'API' });

check('step-without-endpoint', () => {
  it('LA-AUT-UC06-R09-T02 a step of an API flow that invokes what no endpoint exposes is reported, on the step', async () => {
    expect(ofCheck(clean, 'step-without-endpoint')).toEqual([]);
    expect(ofCheck(await loadData(throughApi()), 'step-without-endpoint')).toEqual([
      {
        severity: 'warning', check: 'step-without-endpoint', record: 'EX-LEND-UC01-FL01-S02',
        message: 'Flow step EX-LEND-UC01-FL01-S02 goes through EX-IF01, an API, so it calls an endpoint, but no endpoint exposes EX-LEND-QRY01, which it invokes; add one under EX-LEND-QRY01, or have the step invoke what an endpoint exposes.',
      },
      {
        severity: 'warning', check: 'step-without-endpoint', record: 'EX-LEND-UC02-FL01-S01',
        message: 'Flow step EX-LEND-UC02-FL01-S01 goes through EX-IF01, an API, so it calls an endpoint, but no endpoint exposes EX-LEND-CMD02, which it invokes; add one under EX-LEND-CMD02, or have the step invoke what an endpoint exposes.',
      },
    ]);
  });
});

check('flow-test-level-for-interface', () => {
  it("LA-AUT-UC06-R10-T01 a flow test at a level its flow's interface does not fit is reported; manual fits any", async () => {
    expect(ofCheck(clean, 'flow-test-level-for-interface')).toEqual([]);
    expect(ofCheck(await loadData(throughApi()), 'flow-test-level-for-interface')).toEqual([
      {
        severity: 'warning', check: 'flow-test-level-for-interface', record: 'EX-LEND-UC01-FL01-T',
        message: 'Flow test EX-LEND-UC01-FL01-T runs at level e2e-ui, but its flow EX-LEND-UC01-FL01 goes through EX-IF01, an interface of kind API, which is tested at e2e-api (or manual, with a reason).',
      },
    ]);
    expect(ofCheck(await loadData(changing(complete(), 'interface', () => true, { kind: 'other' })), 'flow-test-level-for-interface')).toEqual([]);
  });
});

// A product's own kind with a group_name field, its records under domain EX-LEND in the groups given, under a
// max_children of 2.
const houseRules = (groups: string[]) =>
  adding(complete(), {
    product_setting: [{ product_id: 'EX', max_children: 2, max_entities_per_aggregate: 7 }],
    product_kind: [{ name: 'house_rule', product_id: 'EX', label: 'House rule', description: 'A rule of the house.', parent_kind: 'domain', stage: 'use-cases', obligation: false }],
    product_kind_field: [{ kind: 'house_rule', position: 1, name: 'group_name', type: 'text', required: false, description: 'Its heading.' }],
    house_rule: groups.map((group_name, i) => ({ id: `EX-LEND-HR${String(i + 1).padStart(2, '0')}`, title: `Rule ${i}`, domain_id: 'EX-LEND', group_name })),
  });

check('too-many-children', () => {
  const requirements = (n: number, group?: (i: number) => string) =>
    Array.from({ length: n }, (_, i) => ({ id: `EX-LEND-UC01-R${String(i + 2).padStart(2, '0')}`, title: `Rule ${i}`, use_case_id: 'EX-LEND-UC01', statement: 'It MUST hold.', ...(group ? { group_name: group(i) } : {}) }));

  it('LA-CHK-UC06-R01-T01 a record with more children of one kind than max_children is a warning naming the parent, kind and count', async () => {
    const ws = await loadData(adding(complete(), { product_setting: [{ product_id: 'EX', max_children: 3, max_entities_per_aggregate: 7 }], uc_requirement: requirements(3) }));
    expect(ofCheck(ws, 'too-many-children')).toEqual([
      expect.objectContaining({ severity: 'warning', record: 'EX-LEND-UC01', message: expect.stringContaining('Use case EX-LEND-UC01 has 4 children of kind uc_requirement, more than the 3') }),
    ]);
  });

  it('LA-CHK-UC06-R02-T01 without the setting the limit is 15', async () => {
    const ws = await loadData(adding(complete(), { uc_requirement: requirements(15) }));
    expect(ofCheck(ws, 'too-many-children').map((p) => p.message)).toEqual([expect.stringContaining('has 16 children of kind uc_requirement, more than the 15')]);
  });

  it('LA-CHK-UC06-R01-T04 tests are never counted, however many a record holds', async () => {
    const tests = Array.from({ length: 20 }, (_, i) => ({ id: `EX-LEND-UC01-R01-T${String(i + 2).padStart(2, '0')}`, title: `Test ${i}`, uc_requirement_id: 'EX-LEND-UC01-R01', level: 'api', state: 'not automated yet' }));
    const ws = await loadData(adding(complete(), { use_case_test: tests }));
    expect(ofCheck(ws, 'too-many-children')).toEqual([]);
  });

  it("LA-CHK-UC06-R05-T01 a flow's steps are counted per path, named when not main", async () => {
    const steps = (path: string, n: number, from: number) =>
      Array.from({ length: n }, (_, i) => ({ id: `EX-LEND-UC01-FL01-S${String(from + i).padStart(2, '0')}`, title: `Step ${from + i}`, flow_id: 'EX-LEND-UC01-FL01', path, position: i + 1 + (path === 'main' ? 2 : 0) }));
    const limit = { product_setting: [{ product_id: 'EX', max_children: 3, max_entities_per_aggregate: 7 }] };
    const even = adding(complete(), { ...limit, flow_step: [...steps('main', 1, 3), ...steps('refused', 3, 4)] });
    expect(ofCheck(await loadData(even), 'too-many-children')).toEqual([]);
    const over = adding(complete(), { ...limit, flow_step: [...steps('main', 1, 3), ...steps('refused', 4, 4)] });
    expect(ofCheck(await loadData(over), 'too-many-children').map((p) => p.message)).toEqual([
      expect.stringContaining('Flow EX-LEND-UC01-FL01 has 4 children of kind flow_step on path refused, more than the 3'),
    ]);
  });

  it('LA-CHK-UC06-R06-T01 grouped requirements are counted per group, groups compared in any letter case', async () => {
    const ws = await loadData(adding(complete(), { product_setting: [{ product_id: 'EX', max_children: 2, max_entities_per_aggregate: 7 }], uc_requirement: requirements(4, (i) => (i < 3 ? (i ? 'Limits' : 'limits ') : 'Other')) }));
    expect(ofCheck(ws, 'too-many-children').map((p) => p.message)).toEqual([expect.stringContaining('has 3 children of kind uc_requirement in group Limits')]);
  });

  it("LA-CHK-UC06-R06-T02 a product kind's records are counted per group_name", async () => {
    const under = ['Noise', 'Noise', 'Tools', 'tools '];
    expect(ofCheck(await loadData(houseRules(under)), 'too-many-children')).toEqual([]);
    expect(ofCheck(await loadData(houseRules([...under, 'Yard', 'Yard', 'Yard'])), 'too-many-children').map((p) => p.message)).toEqual([
      expect.stringContaining('Domain EX-LEND has 3 children of kind house_rule in group Yard, more than the 2'),
    ]);
  });
});

check('aggregate-too-large', () => {
  // Child entities of the loan (EX-LEND-A1, which holds the Loan and its Return), stored in its root's table.
  const children = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `EX-LEND-EN${String(i + 10).padStart(2, '0')}`, title: `Part ${i}`, aggregate_id: 'EX-LEND-A1', role: 'child', in_root_table: true }));

  describe('LA-STD-MODELING-R01-T01 aggregates are small', () => {
    it('LA-CHK-UC06-R08-T01 an aggregate with more entities than max_entities_per_aggregate is a warning naming it, the count and the limit', async () => {
      const at = (n: number) => adding(complete(), { product_setting: [{ product_id: 'EX', max_children: 15, max_entities_per_aggregate: 3 }], entity: children(n) });
      expect(ofCheck(await loadData(at(1)), 'aggregate-too-large')).toEqual([]);
      expect(ofCheck(await loadData(at(2)), 'aggregate-too-large')).toEqual([
        {
          severity: 'warning', check: 'aggregate-too-large', record: 'EX-LEND-A1',
          message: "Aggregate EX-LEND-A1 has 4 entities, more than the 3 that the product's max_entities_per_aggregate setting allows; split it into smaller aggregates that each change together.",
        },
      ]);
    });
  });

  it('LA-CHK-UC06-R09-T01 without the setting the limit is 7', async () => {
    expect(ofCheck(await loadData(adding(complete(), { entity: children(5) })), 'aggregate-too-large')).toEqual([]);
    expect(ofCheck(await loadData(adding(complete(), { entity: children(6) })), 'aggregate-too-large').map((p) => p.message)).toEqual([
      expect.stringContaining('Aggregate EX-LEND-A1 has 8 entities, more than the 7'),
    ]);
  });
});

check('lone-child', () => {
  it('LA-CHK-UC06-R03-T01 a capability with exactly one use case is a warning naming it', async () => {
    const data = changing(complete(), 'use_case', (r) => r.id === 'EX-LEND-UC02', { capability_id: 'EX-LEND-CAP02' });
    const ws = await loadData(adding(data, { capability: [{ id: 'EX-LEND-CAP02', title: 'Catalog', domain_id: 'EX-LEND', position: 2 }] }));
    expect(ofCheck(ws, 'lone-child').map((p) => p.message)).toEqual([
      'Capability EX-LEND-CAP01 has only one use case, EX-LEND-UC01; merge it into a neighboring capability, or give it more.',
      'Capability EX-LEND-CAP02 has only one use case, EX-LEND-UC02; merge it into a neighboring capability, or give it more.',
    ]);
  });

  it("LA-CHK-UC06-R04-T01 a capability's own children of every kind are counted, not theirs; none or two are not reported", async () => {
    // CAP02 holds one use case with two requirements: one child of its own.
    let data = changing(complete(), 'use_case', (r) => r.id === 'EX-LEND-UC02', { capability_id: 'EX-LEND-CAP02' });
    data = adding(data, {
      capability: [
        { id: 'EX-LEND-CAP02', title: 'Catalog', domain_id: 'EX-LEND', position: 2 },
        { id: 'EX-LEND-CAP03', title: 'Repairs', domain_id: 'EX-LEND', position: 3 },
      ],
      uc_requirement: [{ id: 'EX-LEND-UC02-R02', title: 'Tool is priced', use_case_id: 'EX-LEND-UC02', statement: 'The library MUST refuse a tool with no price.' }],
    });
    expect(ofCheck(await loadData(data), 'lone-child').map((p) => p.record)).toEqual(['EX-LEND-CAP01', 'EX-LEND-CAP02']);
    // A record of a product's own kind under CAP02 is a second child of it; CAP03 has none.
    const noted = adding(data, {
      product_kind: [{ name: 'note', product_id: 'EX', label: 'Note', description: 'A note.', parent_kind: 'capability', stage: 'use-cases', obligation: false }],
      note: [
        { id: 'EX-LEND-CAP01-N01', title: 'Lending is busy', capability_id: 'EX-LEND-CAP01' },
        { id: 'EX-LEND-CAP02-N01', title: 'Prices change', capability_id: 'EX-LEND-CAP02' },
      ],
    });
    expect(ofCheck(await loadData(noted), 'lone-child')).toEqual([]);
  });

  it('LA-CHK-UC06-R07-T01 a group with one member is a warning on its parent, standard rules included', async () => {
    let data = changing(complete(), 'standard_rule', () => true, { group_name: 'Imports' });
    data = changing(data, 'api_requirement', () => true, { group_name: 'Errors' });
    data = adding(data, { api_requirement: [{ id: 'EX-LEND-EP01-R02', title: 'Bad body', endpoint_id: 'EX-LEND-EP01', statement: 'A bad body MUST give 400.', group_name: ' errors' }] });
    const ws = await loadData(data);
    expect(ofCheck(ws, 'lone-child').map((p) => p.message)).toEqual([
      'Standard EX-STD-CODE\'s group "Imports" has only one standard rule, EX-STD-CODE-R01; merge it into a neighboring group, or give it more.',
    ]);
  });

  it("LA-CHK-UC06-R07-T02 a product kind's group with one member is a lone-child warning", async () => {
    expect(ofCheck(await loadData(houseRules(['Noise', 'noise', 'Yard'])), 'lone-child').map((p) => p.message)).toEqual([
      'Domain EX-LEND\'s group "Yard" has only one house rule, EX-LEND-HR03; merge it into a neighboring group, or give it more.',
    ]);
  });
});

check('endpoint-route-not-in-file', () => {
  it('LA-TRC-UC15-R01-T01 An endpoint handler\'s file that does not name its method and route is an error', async () => {
    const data = adding(complete(), {
      endpoint: [
        { id: 'EX-LEND-EP02', title: 'Get a tool', query_id: 'EX-LEND-QRY01', method: 'GET', route: '/tools/{toolId}' },
        { id: 'EX-LEND-EP03', title: 'Add a tool', command_id: 'EX-LEND-CMD02', method: 'POST', route: '/tools' },
        { id: 'EX-LEND-EP04', title: 'Remind', command_id: 'EX-LEND-CMD03', method: 'POST', route: '/loans/{loanId}/remind' },
        { id: 'EX-LEND-EP05', title: 'List members', query_id: 'EX-LEND-QRY01', method: 'GET', route: '/members' },
        { id: 'EX-LEND-EP06', title: 'List fees', query_id: 'EX-LEND-QRY01', method: 'GET', route: '/fees' },
      ],
      endpoint_handler: [
        { id: 'EX-LEND-EP02-H', title: 'getTool', endpoint_id: 'EX-LEND-EP02', file: 'src/tool.ts' },
        { id: 'EX-LEND-EP03-H', title: 'postTool', endpoint_id: 'EX-LEND-EP03', file: 'src/add-tool.ts' },
        { id: 'EX-LEND-EP04-H', title: 'postReminder', endpoint_id: 'EX-LEND-EP04', file: 'src/remind.ts' },
        { id: 'EX-LEND-EP05-H', title: 'getMembers', endpoint_id: 'EX-LEND-EP05', file: 'src/members.ts' },
        { id: 'EX-LEND-EP06-H', title: 'getFees', endpoint_id: 'EX-LEND-EP06', file: 'src/fees.ts' },
      ],
    });
    const ws = await loadData(data, {
      missing: ['src/fees.ts'],
      files: {
        'src/router.ts': "// EX-LEND-EP01-H\nrouter.post('/loans', openLoan);\n",
        'src/tool.ts': "// EX-LEND-EP02-H\nconst routes = [{ method: 'GET', pattern: /^\\/tools\\/(\\d+)$/ }];\n",
        'src/add-tool.ts': "// EX-LEND-EP03-H\napp.get('/tools', addTool);\n",
        'src/remind.ts': "// EX-LEND-EP04-H: POST\n\n\n\nconst at = '/loans/:id/remind';\n",
        'src/members.ts': '// EX-LEND-EP05-H\n',
      },
    });
    const found = ofCheck(ws, 'endpoint-route-not-in-file');
    expect(records(found)).toEqual(['EX-LEND-EP03', 'EX-LEND-EP04', 'EX-LEND-EP05']);
    expect(found.every((p) => p.severity === 'error')).toBe(true);
    expect(found.find((p) => p.record === 'EX-LEND-EP03')?.message).toBe(
      "Endpoint EX-LEND-EP03 is POST /tools, but its handler's file src/add-tool.ts does not name that route with that method; correct the endpoint, or point its handler at the file that serves it.",
    );
    // A handler file not there yet is technical-file-missing's, not this check's.
    expect(records(ofCheck(ws, 'technical-file-missing'))).toContain('EX-LEND-EP06-H');
  });
});

check('view-route-not-in-file', () => {
  it('LA-TRC-UC15-R02-T01 A view whose route no component file names is an error', async () => {
    const data = adding(complete(), {
      view: [
        { id: 'EX-V02', title: 'Tool', route: '/tools/<tool-id>' },
        { id: 'EX-V03', title: 'Members', route: '/members' },
        { id: 'EX-V04', title: 'Fees', route: '/fees' },
        { id: 'EX-V05', title: 'Menu' },
      ],
      ui_component: [
        { id: 'EX-UI02', title: 'ToolPage', file: 'web/tool.tsx' },
        { id: 'EX-UI03', title: 'MembersPage', file: 'web/members.tsx' },
        { id: 'EX-UI04', title: 'FeesPage', file: 'web/fees.tsx' },
      ],
      renders: [
        { source_id: 'EX-UI02', target_id: 'EX-V02' },
        { source_id: 'EX-UI03', target_id: 'EX-V03' },
        { source_id: 'EX-UI03', target_id: 'EX-V05' },
        { source_id: 'EX-UI04', target_id: 'EX-V04' },
      ],
    });
    const ws = await loadData(data, {
      missing: ['web/fees.tsx'],
      files: {
        'web/tool.tsx': '// EX-UI02\n<Route path="/tools/:toolId" element={<ToolPage />} />\n',
        'web/members.tsx': '// EX-UI03\nexport function MembersPage() {}\n',
      },
    });
    const found = ofCheck(ws, 'view-route-not-in-file');
    expect(found).toEqual([{
      severity: 'error',
      check: 'view-route-not-in-file',
      record: 'EX-V03',
      message: "View EX-V03 is at /members, but no file of the UI components that render it (web/members.tsx) names that route; correct the view's route, or name it in the file of the component that shows the view there.",
    }]);
  });
});
