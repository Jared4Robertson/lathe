// Checking's flows, each walked through the real `lathe` command on a temporary product: checking the workspace,
// adding a check, finding structural problems, a product's own checks, keeping each level a useful size and keeping
// every change checked. Checking's other flows through the MCP tools are in agent-tools.test.ts.
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { add, flags, LATHE_DIR, LENDING, link, mcp, problemsOf, product, removeProducts } from './product.ts';

afterAll(removeProducts);

const PLUGIN = path.join(LATHE_DIR, '..', 'plugin');

/** A product check that reports every aggregate with no command. */
const NO_COMMAND = {
  name: 'aggregate-without-command',
  product_id: 'TL',
  position: 1,
  severity: 'warning',
  summary: 'An aggregate with no command.',
  explanation: 'Each aggregate of this product is changed by at least one command of its own.',
  query: "SELECT a.id AS record, 'Aggregate ' || a.id || ' has no command.' AS message FROM aggregate a WHERE NOT EXISTS (SELECT 1 FROM command c WHERE c.aggregate_id = a.id) ORDER BY record",
};

describe('Checking flows', () => {
  it('LA-CHK-UC01-FL03-T check the workspace from the command line', async () => {
    const tl = product();
    await tl.seed([
      ...LENDING,
      add('view', { id: 'TL-V01', title: 'Loan page' }),
    ]);
    // S01, S03, S04: the check prints the error, then the warnings and the coverage, and exits 1.
    const broken = tl.check();
    expect(broken.status).toBe(1);
    const errors = broken.stdout.indexOf('Errors (1):\n  [view-unused] TL-V01:');
    const warnings = broken.stdout.indexOf('Warnings (');
    const coverage = broken.stdout.indexOf('Coverage:\n  TL-LEND UC requirement: 0/1 designed');
    expect(errors).toBeGreaterThan(0);
    expect(warnings).toBeGreaterThan(errors);
    expect(coverage).toBeGreaterThan(warnings);
    expect(broken.stdout).toMatch(/1 error, \d+ warnings?\.\n$/);
    // S05: with --json, the whole workspace instead.
    const ws = tl.workspace();
    expect(ws.records.map((r) => r.id)).toContain('TL-LEND-UC01-R01');
    expect(problemsOf(ws, 'view-unused')).toEqual([expect.stringMatching(/^TL-V01: /)]);
    // S06: the Agent fixes the error and checks again: no error, status 0.
    tl.run('remove', 'TL-V01');
    const fixed = tl.check();
    expect(fixed.status).toBe(0);
    expect(fixed.stdout).toMatch(/\n0 errors, \d+ warnings?\.\n$/);
    // S02: data the store refuses is a data-refused error naming the file, the line and the rule; nothing else is checked.
    appendFileSync(path.join(tl.root, 'data', 'domain.jsonl'), '{"id":"TL-SHOP","title":"Shop","product_id":"TL","subdomain_type":"central"}\n');
    const refused = tl.check();
    expect(refused.status).toBe(1);
    expect(refused.stdout).toContain('Errors (1):\n  [data-refused]');
    expect(refused.stdout).toContain('data/domain.jsonl:2:');
    expect(refused.stdout).not.toContain('Warnings');
    expect(refused.stdout).not.toContain('Coverage:');
  });

  it('LA-CHK-UC02-FL03-T add a check', async () => {
    const tl = product();
    await tl.seed([...LENDING, add('aggregate', { id: 'TL-LEND-A2', title: 'Tool', domain_id: 'TL-LEND' })]);
    // S01: the check as one row through the command layer.
    expect(tl.run('add', 'check', ...flags(NO_COMMAND))).toContain('Added check aggregate-without-command');
    expect(tl.read('data/check.jsonl')).toContain('"name":"aggregate-without-command"');
    // S02: the next check runs it among the others, reading the typed tables.
    const ws = tl.workspace();
    expect(problemsOf(ws, 'aggregate-without-command')).toEqual(['TL-LEND-A2: Aggregate TL-LEND-A2 has no command.']);
    expect(tl.check().stdout).toContain('[aggregate-without-command] TL-LEND-A2: Aggregate TL-LEND-A2 has no command.');
  });

  it('LA-CHK-UC04-FL03-T find structural problems', async () => {
    const tl = product();
    // Stages written at different times: a view nothing uses yet, a use case with no flow, a test at a level its
    // kind does not allow, and a policy hearing an event of a stored aggregate that is delivered in process.
    await tl.seed([
      ...LENDING,
      add('table', { id: 'TL-LEND-EN01-TB', title: 'Loans', entity_id: 'TL-LEND-EN01', name: 'loan', storage: 'table' }),
      add('aggregate', { id: 'TL-LEND-A2', title: 'Tool', domain_id: 'TL-LEND' }),
      add('command', { id: 'TL-LEND-CMD02', title: 'Open a reminder', aggregate_id: 'TL-LEND-A1' }),
      { op: 'add', table: 'command_change', row: { command_id: 'TL-LEND-CMD01', aggregate_id: 'TL-LEND-A2', reason: 'The tool must never show as lent without its loan.' } },
      add('policy', { id: 'TL-LEND-PO01', title: 'Remind on loan', command_id: 'TL-LEND-CMD02', statement: 'Whenever a loan is opened, the library MUST open its reminder.' }),
      link('TL-LEND-PO01', 'hears', 'TL-LEND-EV01'),
      add('event_type', { id: 'TL-LEND-EV01-ET', title: 'Loan opened', domain_event_id: 'TL-LEND-EV01', delivery: 'in process' }),
      add('view', { id: 'TL-V01', title: 'Loan page' }),
      add('use_case_test', { id: 'TL-LEND-UC01-R01-T01', title: 'A tool on loan is refused', uc_requirement_id: 'TL-LEND-UC01-R01', level: 'integration', state: 'not automated yet' }),
    ]);
    // S01, S03: what nothing uses is an error.
    const ws = tl.workspace();
    expect(problemsOf(ws, 'view-unused')).toEqual([expect.stringMatching(/^TL-V01: /)]);
    // S04: the shape warnings, the recorded exception listed apart, and the use case with no flow in coverage.
    expect(problemsOf(ws, 'test-level-not-allowed')).toEqual([expect.stringMatching(/^TL-LEND-UC01-R01-T01: /)]);
    expect(problemsOf(ws, 'event-not-by-outbox')).toEqual([expect.stringMatching(/^TL-LEND-EV01: /)]);
    expect(ws.exceptions).toEqual([expect.objectContaining({ command: 'TL-LEND-CMD01', aggregate: 'TL-LEND-A2' })]);
    const out = tl.check().stdout;
    expect(out).toMatch(/\n\nRecorded exceptions[^\n]*\n[^\n]*TL-LEND-CMD01/);
    expect(out).toContain('[use-case-without-flow] ');
    // S05: they fix the error and the warnings as the stages fill in.
    tl.run('remove', 'TL-V01');
    tl.run('set', 'TL-LEND-UC01-R01-T01', '--level', 'service');
    tl.run('set', 'TL-LEND-EV01-ET', '--delivery', 'outbox');
    const fixed = tl.workspace();
    expect(fixed.problems.filter((p) => ['view-unused', 'test-level-not-allowed', 'event-not-by-outbox'].includes(p.check))).toEqual([]);
    // S02: a test given its parent's ID is refused once, naming its rule, file and line, and nothing that follows from it.
    appendFileSync(path.join(tl.root, 'data', 'use_case_test.jsonl'), '{"id":"TL-LEND-UC01-R01","title":"Given its parent\'s ID","uc_requirement_id":"TL-LEND-UC01-R01","level":"service","state":"not automated yet"}\n');
    const refused = tl.workspace();
    expect(refused.problems).toHaveLength(1);
    expect(refused.problems[0]).toMatchObject({ severity: 'error', check: 'data-refused' });
    expect(refused.problems[0].message).toMatch(/^data\/use_case_test\.jsonl:2: .*\[[a-z-]+\]$/);
  });

  it('LA-CHK-UC05-FL03-T add a product\'s own checks', async () => {
    const tl = product();
    await tl.seed([...LENDING, add('aggregate', { id: 'TL-LEND-A2', title: 'Tool', domain_id: 'TL-LEND' })]);
    // S01, S02: a house rule, as a check row with the product's product_id, in the product's data.
    tl.run('add', 'check', ...flags(NO_COMMAND));
    expect(tl.read('data/check.jsonl')).toContain('"product_id":"TL"');
    // S04: Lathe's checks run first, then the product's, its problems carrying its row's name.
    const ws = tl.workspace();
    const names = ws.problems.map((p) => p.check);
    expect(problemsOf(ws, 'aggregate-without-command')).toEqual(['TL-LEND-A2: Aggregate TL-LEND-A2 has no command.']);
    expect(names.lastIndexOf('aggregate-without-command')).toBe(names.length - 1);
    // S07: they fix what it finds and check again until it is clean of it.
    tl.run('add', 'command', '--id', 'TL-LEND-CMD02', '--title', 'Add a tool', '--aggregate_id', 'TL-LEND-A2');
    expect(problemsOf(tl.workspace(), 'aggregate-without-command')).toEqual([]);
    // S03: a check named like one of Lathe's is refused, naming lathe/data/check.jsonl.
    expect(tl.refused('add', 'check', ...flags({ ...NO_COMMAND, name: 'view-unused' }))).toContain('lathe/data/check.jsonl');
    // S05: a product check whose query fails is an error naming it, and the other checks still run.
    tl.run('add', 'check', ...flags({ ...NO_COMMAND, name: 'broken-house-rule', position: 2, query: 'SELECT id AS record, title AS message FROM no_such_table' }));
    await tl.seed([add('view', { id: 'TL-V01', title: 'Loan page' })]);
    const failing = tl.workspace();
    expect(failing.problems.filter((p) => p.message.includes('broken-house-rule')).map((p) => p.severity)).toEqual(['error']);
    expect(problemsOf(failing, 'view-unused')).toHaveLength(1);
    // S06: a checks key in lathe.config.json is refused as an unknown setting.
    tl.write('lathe.config.json', '{ "checks": [] }\n');
    const config = tl.check();
    expect(config.status).toBe(1);
    expect(`${config.stdout}${config.stderr}`).toContain('unknown setting "checks"');
  });

  it('LA-CHK-UC06-FL03-T keep each level of the spec a useful size', async () => {
    const tl = product();
    await tl.seed([
      ...LENDING,
      add('entity', { id: 'TL-LEND-EN02', title: 'Return', aggregate_id: 'TL-LEND-A1', role: 'child', in_root_table: true }),
      add('entity', { id: 'TL-LEND-EN03', title: 'Renewal', aggregate_id: 'TL-LEND-A1', role: 'child', in_root_table: true }),
      link('TL-LEND-EN01', 'has_many', 'TL-LEND-EN02'),
      link('TL-LEND-EN01', 'has_many', 'TL-LEND-EN03'),
      add('uc_requirement', { id: 'TL-LEND-UC01-R02', title: 'A member in debt is refused', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse a member who owes a fee.' }),
      add('uc_requirement', { id: 'TL-LEND-UC01-R03', title: 'A tool in repair is refused', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse a tool in repair.' }),
      add('uc_requirement', { id: 'TL-LEND-UC01-R04', title: 'The due date is set', use_case_id: 'TL-LEND-UC01', statement: 'The loan MUST be due two weeks after it opens.', group_name: 'Dates' }),
    ]);
    // S01: the Owner sets the product's limits.
    tl.run('add', 'product_setting', '--product_id', 'TL', '--max_children', '2', '--max_entities_per_aggregate', '2');
    // S02, S03: too many children, too many entities, and a capability and a group with one child.
    const ws = tl.workspace();
    expect(problemsOf(ws, 'too-many-children').sort()).toEqual([expect.stringMatching(/^TL-LEND-A1: .*3 children of kind entity/), expect.stringMatching(/^TL-LEND-UC01: .*3 /)]);
    expect(problemsOf(ws, 'aggregate-too-large')).toEqual([expect.stringMatching(/^TL-LEND-A1: /)]);
    expect(problemsOf(ws, 'lone-child').sort()).toEqual([expect.stringMatching(/^TL-LEND-CAP01: /), expect.stringMatching(/^TL-LEND-UC01: .*"Dates"/)]);
    // S04: they add a level, merge one and raise nothing, then check again.
    tl.run('set', 'product_setting', '--product_id', 'TL', '--max_children', '15', '--max_entities_per_aggregate', '7');
    tl.run('add', 'use_case', '--id', 'TL-LEND-UC02', '--title', 'Return a tool', '--capability_id', 'TL-LEND-CAP01');
    tl.run('set', 'TL-LEND-UC01-R04', '--group_name', '');
    const fixed = tl.workspace();
    expect(fixed.problems.filter((p) => ['too-many-children', 'aggregate-too-large', 'lone-child'].includes(p.check))).toEqual([]);
  });

  it('LA-CHK-UC08-FL04-T keep every change to the spec checked', async () => {
    // S01: the plugin declares the guard hook on every tool that edits a file by hand.
    const hooks = JSON.parse(readFileSync(path.join(PLUGIN, 'hooks', 'hooks.json'), 'utf8'));
    const [entry] = hooks.hooks.PreToolUse;
    expect(entry.matcher.split('|').sort()).toEqual(['Edit', 'MultiEdit', 'NotebookEdit', 'Write']);
    const guard = path.join(PLUGIN, 'scripts', path.basename(entry.hooks[0].args[0]));
    const tl = product();
    const hook = (tool: string, file: string) => {
      const result = spawnSync(process.execPath, [guard], { input: JSON.stringify({ tool_name: tool, cwd: tl.root, tool_input: { file_path: file } }), encoding: 'utf8' });
      expect(result.status).toBe(0);
      return result.stdout.trim() ? JSON.parse(result.stdout).hookSpecificOutput : null;
    };
    // S02: the Agent changes records through the MCP tools, which validate each write.
    const server = mcp(tl.root);
    try {
      await server.initialize();
      expect((await server.call('add', { domain: { id: 'TL-LEND', title: 'Lending', product_id: 'TL', subdomain_type: 'core' } })).result!.isError).toBeUndefined();
      const refused = await server.call('add', { domain: { id: 'TL-SHOP', title: 'Shop', product_id: 'TL', subdomain_type: 'central' } });
      expect(refused.result!.isError).toBe(true);
      expect(refused.result!.content[0].text).toContain('subdomain_type');
    } finally {
      await server.close();
    }
    // S03: a hand edit of a data file is refused before it happens, pointing at the tools.
    for (const tool of ['Write', 'Edit', 'MultiEdit']) {
      const denied = hook(tool, path.join(tl.root, 'data', 'domain.jsonl'));
      expect(denied).toMatchObject({ hookEventName: 'PreToolUse', permissionDecision: 'deny' });
      expect(denied.permissionDecisionReason).toContain("Lathe's MCP tools");
    }
    // S04: every other edit goes through silently.
    expect(hook('Edit', path.join(tl.root, 'README.md'))).toBeNull();
    const elsewhere = mkdtempSync(path.join(tmpdir(), 'lathe-flow-other-'));
    mkdirSync(path.join(elsewhere, 'data'));
    writeFileSync(path.join(elsewhere, 'data', 'notes.jsonl'), '');
    expect(hook('Write', path.join(elsewhere, 'data', 'notes.jsonl'))).toBeNull();
  });
});
