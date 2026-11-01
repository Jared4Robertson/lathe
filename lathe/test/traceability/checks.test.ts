// Lathe's checks of the Traceability domain, one at a time: each starts from the complete product, which gives no
// problem, and changes one thing to break the rule. LA-STD-CODE-R05: each of the domain's check rows is tested here.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Workspace } from '../../src/index.ts';
import { adding, changing, complete, gaps, loadData, ofCheck, records, refusals, removeData, without } from '../helpers.ts';

afterAll(removeData);

let clean: Workspace;
beforeAll(async () => {
  clean = await loadData(complete());
});

/** A check row's tests, under its name. */
const check = (name: string, body: () => void) => describe(name, body);

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
    expect(await refused({ state: 'manual', level: 'browser', file: undefined })).toEqual(['check']);
    expect(await refused({ manual_reason: 'Looked at by eye.' })).toEqual(['check']);
    expect(await refused({ state: 'not automated yet', file: undefined })).toEqual([]);
    expect(await refused({ state: 'manual', level: 'browser', file: undefined, manual_reason: 'Looked at by eye.' })).toEqual([]);
    const later = await loadData(test({ state: 'not automated yet', file: 'test/later.test.ts' }), { missing: ['test/later.test.ts'] });
    expect(ofCheck(later, 'test-file-missing').map((p) => [p.severity, p.record])).toEqual([['warning', 'EX-LEND-UC01-R01-T01']]);
    expect(later.problems.filter((p) => p.severity === 'error')).toEqual([]);
  });

  it('LA-TRC-UC05-R01-T04 a folder is not a test file', async () => {
    const ws = await loadData(changing(complete(), 'policy_test', () => true, { file: 'src' }), { missing: ['src'] });
    expect(records(ofCheck(ws, 'test-file-missing'))).toEqual(['EX-LEND-PO01-T']);
  });
});

check('test-file-missing-id', () => {
  it('LA-TRC-UC05-R01-T04 an automated test whose file does not name it is an error', async () => {
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
        { name: 'house_rule', product_id: 'EX', label: 'House rule', description: 'A rule of the house.', parent_kind: 'domain', stage: 'use-cases', obligation: true, complexity: 'essential' },
        { name: 'script', product_id: 'EX', label: 'Script', description: 'A script.', parent_kind: 'domain', stage: 'technical-specification', obligation: false, complexity: 'accidental' },
        { name: 'rule_check', product_id: 'EX', label: 'Rule check', description: 'A script that checks a rule.', parent_kind: 'domain', stage: 'test-plan', obligation: false, complexity: 'as-parent' },
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

describe('coverage gaps as warnings', () => {
  let ws: Workspace;
  beforeAll(async () => {
    let data = without(complete(), 'fulfills', (r) => r.source_id === 'EX-LEND-UC02-FL-S01');
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
    expect(ofCheck(ws, 'not-designed').map((p) => p.message)).toEqual(['UC requirement EX-LEND-UC02-R01 is not designed yet: no step of EX-LEND-UC02-FL fulfills it.']);
    // The service's file is missing; the UC requirement whose command calls it rests on it.
    expect(ofCheck(ws, 'not-built').map((p) => p.record)).toEqual(['EX-LEND-DS01', 'EX-LEND-UC01-R01']);
    expect(ofCheck(ws, 'not-proved').map((p) => p.message)).toEqual(['Specification EX-LEND-SP01 is not proved yet: its test is not automated yet.']);
  });
});

check('pattern-rule-test-outside-followers', () => {
  it('LA-TRC-UC08-R02-T01 a pattern rule test naming a domain that does not follow the pattern is an error', async () => {
    let data = adding(complete(), { domain: [{ id: 'EX-SHOP', title: 'Shop', product_id: 'EX', subdomain_type: 'supporting', description: 'Selling spare parts.' }] });
    data = adding(data, { pattern_rule_test: [{ id: 'EX-PAT-ACT-R01-T02', title: 'In the shop', pattern_rule_id: 'EX-PAT-ACT-R01', domain_id: 'EX-SHOP', level: 'service', state: 'not automated yet', when: 'The clerk saves a sale.', then: 'The sale reads the same everywhere.' }] });
    const ws = await loadData(data);
    expect(ofCheck(ws, 'pattern-rule-test-outside-followers')).toEqual([
      expect.objectContaining({ severity: 'error', record: 'EX-PAT-ACT-R01-T02', message: expect.stringContaining('which does not follow pattern EX-PAT-ACT') }),
    ]);
    // Once the domain follows the pattern itself, the test is in place.
    const following = adding(data, { follows: [{ source_id: 'EX-SHOP', target_id: 'EX-PAT-ACT' }] });
    expect(ofCheck(await loadData(following), 'pattern-rule-test-outside-followers')).toEqual([]);
    // Every following domain owes every rule, so no test in one counts for nothing.
    expect(ofCheck(clean, 'pattern-rule-test-outside-followers')).toEqual([]);
  });
});

check('pattern-setting-missing', () => {
  it("LA-TRC-UC07-R03-T02 a use case that answers each setting of its pattern is in place; one that gives no value for a setting is an error naming it", async () => {
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

check('endpoint-route-not-in-file', () => {
  it('LA-TRC-UC15-R01-T01 An endpoint handler\'s file that does not name its method and route is an error', async () => {
    const data = adding(complete(), {
      endpoint: [
        { id: 'EX-LEND-EP02', title: 'GET /tools/{toolId}', query_id: 'EX-LEND-QRY01', method: 'GET', route: '/tools/{toolId}', description: 'Answers with what the route names.' },
        { id: 'EX-LEND-EP03', title: 'POST /tools', command_id: 'EX-LEND-CMD02', method: 'POST', route: '/tools', description: 'Answers with what the route names.' },
        { id: 'EX-LEND-EP04', title: 'POST /loans/{loanId}/remind', command_id: 'EX-LEND-CMD03', method: 'POST', route: '/loans/{loanId}/remind', description: 'Answers with what the route names.' },
        { id: 'EX-LEND-EP05', title: 'GET /members', query_id: 'EX-LEND-QRY01', method: 'GET', route: '/members', description: 'Answers with what the route names.' },
        { id: 'EX-LEND-EP06', title: 'GET /fees', query_id: 'EX-LEND-QRY01', method: 'GET', route: '/fees', description: 'Answers with what the route names.' },
      ],
      endpoint_handler: [
        { id: 'EX-LEND-EP02-H', title: 'getTool', endpoint_id: 'EX-LEND-EP02', file: 'src/tool.ts', description: 'Reads the request and calls its handler.' },
        { id: 'EX-LEND-EP03-H', title: 'postTool', endpoint_id: 'EX-LEND-EP03', file: 'src/add-tool.ts', description: 'Reads the request and calls its handler.' },
        { id: 'EX-LEND-EP04-H', title: 'postReminder', endpoint_id: 'EX-LEND-EP04', file: 'src/remind.ts', description: 'Reads the request and calls its handler.' },
        { id: 'EX-LEND-EP05-H', title: 'getMembers', endpoint_id: 'EX-LEND-EP05', file: 'src/members.ts', description: 'Reads the request and calls its handler.' },
        { id: 'EX-LEND-EP06-H', title: 'getFees', endpoint_id: 'EX-LEND-EP06', file: 'src/fees.ts', description: 'Reads the request and calls its handler.' },
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
        { id: 'EX-V02', title: 'Tool', route: '/tools/<tool-id>', description: 'A page of the library.' },
        { id: 'EX-V03', title: 'Members', route: '/members', description: 'A page of the library.' },
        { id: 'EX-V04', title: 'Fees', route: '/fees', description: 'A page of the library.' },
        { id: 'EX-V05', title: 'Menu', description: 'The menu on every page.' },
      ],
      ui_component: [
        { id: 'EX-UI02', title: 'ToolPage', file: 'web/tool.tsx', description: 'The page component.' },
        { id: 'EX-UI03', title: 'MembersPage', file: 'web/members.tsx', description: 'The page component.' },
        { id: 'EX-UI04', title: 'FeesPage', file: 'web/fees.tsx', description: 'The page component.' },
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

check('serves-no-outcome', () => {
  it('LA-TRC-UC20-R02-T01 LA-STD-MODELING-R13-T01 an aggregate, read model or obligation no outcome reaches is a warning saying how to fix it', async () => {
    expect(ofCheck(clean, 'serves-no-outcome')).toEqual([]);
    // Lending serves no outcome: nothing it reaches serves one either.
    const ws = await loadData(without(complete(), 'serves', () => true));
    const found = ofCheck(ws, 'serves-no-outcome');
    expect(found.every((p) => p.severity === 'warning')).toBe(true);
    expect(records(found)).toEqual([
      'EX-LEND-A1', 'EX-LEND-A1-SR01', 'EX-LEND-A2', 'EX-LEND-DS01', 'EX-LEND-EP01-R01', 'EX-LEND-INV01', 'EX-LEND-PO01', 'EX-LEND-RM01',
      'EX-LEND-SP01', 'EX-LEND-UC01-R01', 'EX-LEND-UC02-R01', 'EX-PAT-ACT-R01', 'EX-STD-CODE-R01', 'EX-V01-R01', 'EX-VO01-C01',
    ]);
    expect(found.find((p) => p.record === 'EX-LEND-A2')!.message).toBe(
      'Aggregate EX-LEND-A2 serves no outcome: no use case whose capability serves a business outcome reaches it. Write the use case that needs it, or remove it.',
    );
  });

  it('LA-TRC-UC20-R02-T02 a record only an unreached use case would reach serves no outcome', async () => {
    // No step invokes the query: its read model is reached by nothing else.
    const ws = await loadData(without(complete(), 'invokes', (r) => r.target_id === 'EX-LEND-QRY01'));
    expect(records(ofCheck(ws, 'serves-no-outcome'))).toEqual(['EX-LEND-RM01']);
  });
});

/** The complete product with the records given no longer generated by its tooling record. */
const handWritten = (...ids: string[]) => without(complete(), 'generates', (r) => ids.includes(String(r.target_id)));
const fill = (...ids: string[]) => ({ fills: ids.map((id) => ({ source_id: id, target_id: 'EX-PAT-ACT-SL01' })) });

check('accidental-not-accounted-for', () => {
  it('LA-STD-PRINCIPLES-R06-T01 An accidental record is a warning until a tooling record generates it, something provides it or a record above it, or it fills a slot serving an essential record', async () => {
    expect(ofCheck(clean, 'accidental-not-accounted-for')).toEqual([]);
    // Written by hand, provided by nothing: the command handler, the data store and the generator itself.
    let data = handWritten('EX-LEND-CMD02-H', 'EX-UI01', 'EX-LEND-REPO01', 'EX-LEND-REPO02');
    data = without(data, 'provided_by', (r) => r.source_id === 'EX-STORE01' || r.source_id === 'EX-LEND-TOOL01');
    // Fills of the slot: a UI component that builds a view requirement, a repository whose aggregate has a storage
    // requirement, and a repository that serves nothing essential.
    data = adding(data, fill('EX-UI01', 'EX-LEND-REPO01', 'EX-LEND-REPO02'));
    const ws = await loadData(data);
    expect(records(ofCheck(ws, 'accidental-not-accounted-for'))).toEqual(['EX-LEND-CMD02-H', 'EX-LEND-REPO02', 'EX-LEND-TOOL01', 'EX-STORE01']);
    expect(ofCheck(ws, 'accidental-not-accounted-for').find((p) => p.record === 'EX-LEND-CMD02-H')?.message).toBe(
      'Command handler EX-LEND-CMD02-H is accidental complexity nothing accounts for: no tooling record generates it, nothing provides it, and it fills no slot; generate it, name its provider, or record the pattern slot it fills.',
    );
    expect(ofCheck(ws, 'accidental-not-accounted-for').find((p) => p.record === 'EX-LEND-REPO02')?.message).toBe(
      'Repository EX-LEND-REPO02 is accidental complexity nothing accounts for: it fills a slot but serves no essential record; put it under the essential record it implements, or remove it.',
    );
    // An engineering standard is accidental, and its rule with it, until it is provided; the rule's test follows them
    // and is never reported. A quality is essential.
    const unprovided = without(complete(), 'provided_by', (r) => r.source_id === 'EX-STD-CODE');
    expect(records(ofCheck(await loadData(unprovided), 'accidental-not-accounted-for'))).toEqual(['EX-STD-CODE', 'EX-STD-CODE-R01']);
    expect(ofCheck(await loadData(changing(unprovided, 'standard', () => true, { type: 'quality' })), 'accidental-not-accounted-for')).toEqual([]);
  });
});

check('pattern-candidate', () => {
  it('LA-STD-PRINCIPLES-R06-T02 Each fill is listed as accidental debt in its domain, and the third fill of one slot makes it a pattern candidate', async () => {
    expect(clean.coverage.find((c) => c.domain === 'EX-LEND')?.debt).toEqual([
      { id: 'EX-LEND-CMD01-H', slot: 'EX-PAT-ACT-SL01' },
      { id: 'EX-LEND-INV01-RL', slot: 'EX-PAT-ACT-SL01' },
    ]);
    expect(ofCheck(clean, 'pattern-candidate')).toEqual([]);
    const three = await loadData(adding(handWritten('EX-LEND-CMD02-H'), fill('EX-LEND-CMD02-H')));
    expect(ofCheck(three, 'pattern-candidate')).toEqual([
      {
        severity: 'warning',
        check: 'pattern-candidate',
        record: 'EX-PAT-ACT-SL01',
        message: "Slot EX-PAT-ACT-SL01 (Saving rule) has 3 fills (EX-LEND-CMD01-H, EX-LEND-CMD02-H, EX-LEND-INV01-RL): a pattern candidate; make the pattern's fixed part or a setting express what they repeat, and generate them.",
      },
    ]);
  });
});
