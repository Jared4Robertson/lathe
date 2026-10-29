// Authoring's and Checking's flows through the MCP tools (LA-IF04), each walked through a real `lathe mcp` server, as
// the plugin starts it, on a temporary product: the Agent writes with add, set, move, link, unlink and remove, reads
// with show and next_id, and checks with check. The same flows through the CLI are in authoring.test.ts and
// checking.test.ts.
import { appendFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { Command } from '../../src/index.ts';
import { add, LATHE_DIR, LENDING, link, mcp, product, removeProducts, type Product } from './product.ts';

afterAll(removeProducts);

interface Problem { severity: string; check: string; record: string | null; message: string }
interface Gap { id: string; kind: string; missing: string; message: string }
interface Checked {
  errors: number;
  warnings: number;
  problems: Problem[];
  exceptions: { command: string; aggregate: string; reason: string }[];
  products: { root: string; coverage: { domain: string | null; gaps: Gap[] }[] }[];
}

/** A product seeded with the commands, and an MCP server on it; `walk` closes the server when the flow is done. */
async function agent(seed: Command[] = []) {
  const tl = product();
  if (seed.length) await tl.seed(seed);
  const server = mcp(tl.root);
  await server.initialize();
  const reply = async (name: string, args: object) => {
    const answer = await server.call(name, args);
    expect(answer.error, JSON.stringify(answer.error)).toBeUndefined();
    return answer.result as { isError?: boolean; content: { text: string }[]; structuredContent?: Record<string, unknown> };
  };
  const tools = {
    tl,
    server,
    /** Calls a tool and expects it to succeed; returns its text. */
    async ok(name: string, args: object) {
      const result = await reply(name, args);
      expect(result.isError, result.content[0].text).toBeUndefined();
      return result.content[0].text;
    },
    /** Calls a tool and expects the refusal; returns its text. */
    async refused(name: string, args: object) {
      const result = await reply(name, args);
      expect(result.isError, result.content[0].text).toBe(true);
      return result.content[0].text;
    },
    /** Calls the check tool; returns what it found. */
    async check() {
      return (await reply('check', {})).structuredContent as unknown as Checked;
    },
  };
  return tools;
}

type Agent = Awaited<ReturnType<typeof agent>>;

/** Runs the flow with an Agent on a seeded product, and stops its server after. */
async function walk(seed: Command[], flow: (a: Agent) => Promise<void>) {
  const a = await agent(seed);
  try {
    await flow(a);
  } finally {
    await a.server.close();
  }
}

const found = (checked: Checked, check: string) => checked.problems.filter((p) => p.check === check).map((p) => `${p.record}: ${p.message}`);
/** The coverage gaps of a kind the check tool gives, every product's and domain's, as `missing record`. */
const gaps = (checked: Checked, missing: string) =>
  checked.products.flatMap((p) => p.coverage).flatMap((c) => c.gaps).filter((g) => g.missing === missing).map((g) => `${g.missing} ${g.id}`);
const data = (tl: Product, table: string) => tl.read(`data/${table}.jsonl`).split('\n').filter(Boolean).map((l) => JSON.parse(l));

/** A product kind several flows declare. */
const HOUSE_KIND = { name: 'launcher', product_id: 'TL', label: 'Launcher', description: 'A file the product starts from.', parent_kind: 'domain', stage: 'technical-specification', obligation: false };
const NO_COMMAND = {
  name: 'aggregate-without-command',
  product_id: 'TL',
  position: 1,
  severity: 'warning',
  summary: 'An aggregate with no command.',
  explanation: 'Each aggregate of this product is changed by at least one command of its own.',
  query: "SELECT a.id AS record, 'Aggregate ' || a.id || ' has no command.' AS message FROM aggregate a WHERE NOT EXISTS (SELECT 1 FROM command c JOIN entity e ON e.id = c.entity_id WHERE e.aggregate_id = a.id) ORDER BY record",
};

describe('Authoring flows through the MCP tools', () => {
  it('LA-AUT-UC01-FL04-T change a record through the MCP tools', async () => {
    await walk([], async (a) => {
      // S01: the skills send the Agent to the tools, never to the files.
      const skill = readFileSync(path.join(LATHE_DIR, '..', 'plugin', 'skills', 'model-a-domain', 'SKILL.md'), 'utf8');
      expect(skill).toMatch(/MCP tools/);
      // S02: the add tool's input schema gives each table's columns from the schema.
      const listed = await a.server.request('tools/list');
      const addTool = JSON.stringify(listed.result!.tools!.find((t) => t.name === 'add')!.inputSchema);
      expect(addTool).toContain('subdomain_type');
      await a.ok('add', { domain: { id: 'TL-LEND', title: 'Lending', product_id: 'TL', subdomain_type: 'core', description: 'Lending tools to members and getting them back.' } });
      await a.ok('add', { aggregate: { id: 'TL-LEND-A1', title: 'Loan', domain_id: 'TL-LEND', identity: 'Loan ID', description: 'One loan.' } });
      await a.ok('add', { entity: { id: 'TL-LEND-EN01', title: 'Loan', aggregate_id: 'TL-LEND-A1', role: 'root', description: 'The loan itself.' } });
      await a.ok('add', { entity_field: { entity_id: 'TL-LEND-EN01', position: 1, name: 'Due date', meaning: 'The last day of the loan.', type: 'date', required: true } });
      // S03: a column changed.
      await a.ok('set', { aggregate: { id: 'TL-LEND-A1', description: 'One tool lent to one member.' } });
      // S04: the rows land in the data files, one line each.
      expect(data(a.tl, 'aggregate')).toEqual([{ id: 'TL-LEND-A1', title: 'Loan', domain_id: 'TL-LEND', identity: 'Loan ID', description: 'One tool lent to one member.' }]);
      expect(data(a.tl, 'entity_field').map((f) => f.name)).toEqual(['Due date']);
      // S05: show returns what was written.
      expect(await a.ok('show', { id: 'TL-LEND-A1' })).toContain('description: One tool lent to one member.');
      // S07: move; S08, S09: link and unlink; S10: remove.
      await a.ok('add', { capability: { id: 'TL-LEND-CAP01', title: 'Lending', domain_id: 'TL-LEND', position: 1, description: 'Lending tools and taking them back.' } });
      await a.ok('add', { capability: { id: 'TL-LEND-CAP02', title: 'Returns', domain_id: 'TL-LEND', position: 2, description: 'Taking tools back from members.' } });
      await a.ok('add', { use_case: { id: 'TL-LEND-UC01', title: 'Return a tool', capability_id: 'TL-LEND-CAP01', goal: 'A member brings a tool back.' } });
      await a.ok('move', { id: 'TL-LEND-UC01', parent: 'TL-LEND-CAP02' });
      expect(data(a.tl, 'use_case')[0].capability_id).toBe('TL-LEND-CAP02');
      await a.ok('add', { business_outcome: { id: 'TL-BO01', title: 'More tools in use', product_id: 'TL', statement: 'Members borrow more.', measure: 'Loans per month.', target: 'Twice as many.' } });
      await a.ok('link', { source: 'TL-LEND-CAP02', relation: 'serves', target: 'TL-BO01' });
      expect(data(a.tl, 'serves')).toEqual([{ source_id: 'TL-LEND-CAP02', target_id: 'TL-BO01' }]);
      await a.ok('unlink', { source: 'TL-LEND-CAP02', relation: 'serves', target: 'TL-BO01' });
      expect(await a.ok('show', { id: 'TL-BO01' })).not.toContain('Served by');
      await a.ok('remove', { id: 'TL-LEND-CAP01' });
      expect(data(a.tl, 'capability').map((c) => c.id)).toEqual(['TL-LEND-CAP02']);
      // S06: a refused write returns every reason and changes no file.
      const before = a.tl.read('data/domain.jsonl');
      expect(await a.refused('add', { domain: { id: 'TL-SHOP', title: 'Shop', product_id: 'TL', subdomain_type: 'central', description: 'Selling tools to members.' } })).toContain('subdomain_type');
      expect(a.tl.read('data/domain.jsonl')).toBe(before);
    });
  });

  it('LA-AUT-UC02-FL04-T split a product into domains through the MCP tools', async () => {
    await walk([], async (a) => {
      // S01: the modeling skill's first step is to find the product's business capabilities.
      const skill = readFileSync(path.join(LATHE_DIR, '..', 'plugin', 'skills', 'model-a-domain', 'SKILL.md'), 'utf8');
      expect(skill).toMatch(/Before you write any record, find the product's business capabilities and make each one a domain/);
      // S02: the add tool describes the domain table as the reference does.
      const listed = await a.server.request('tools/list');
      expect(JSON.stringify(listed.result!.tools!.find((t) => t.name === 'add')!.inputSchema)).toContain('for one business capability');
      // S03: one domain per capability, with its subdomain type; one is named for a layer.
      await a.ok('add', { domain: { id: 'TL-LEND', title: 'Lending', product_id: 'TL', subdomain_type: 'core', description: 'Lending tools to members and getting them back.' } });
      await a.ok('add', { domain: { id: 'TL-CAT', title: 'Web app', product_id: 'TL', subdomain_type: 'supporting', description: 'The tools the library holds and how members find them.' } });
      // S04: the check warns of the domain named for a technology; the Agent renames it.
      expect(found(await a.check(), 'domain-named-for-technology')).toEqual([expect.stringMatching(/^TL-CAT: .*"web app"/)]);
      await a.ok('set', { domain: { id: 'TL-CAT', title: 'Catalog' } });
      expect(found(await a.check(), 'domain-named-for-technology')).toEqual([]);
    });
  });

  it('LA-AUT-UC04-FL04-T declare a product\'s own kinds and relations through the MCP tools', async () => {
    await walk(LENDING, async (a) => {
      const addSchema = async () => JSON.stringify((await a.server.request('tools/list')).result!.tools!.find((t) => t.name === 'add')!.inputSchema);
      expect(await addSchema()).not.toContain('launcher');
      // S01: a product kind with its fields, in a stage.
      await a.ok('add', { product_kind: HOUSE_KIND });
      await a.ok('add', { product_kind_field: { kind: 'launcher', position: 1, name: 'file', type: 'text', required: true, description: 'The file it starts from.' } });
      // S02: a new relation.
      await a.ok('add', { product_relation: { name: 'starts', source_kind: 'launcher', target_kind: 'command', product_id: 'TL', forward_label: 'Starts', reverse_label: 'Started by', description: 'The launcher starts the command.' } });
      // S03: the server announces its tools again, and add takes the new kind.
      expect(await addSchema()).toContain('launcher');
      expect(a.server.notifications).toContain('notifications/tools/list_changed');
      await a.ok('add', { launcher: { id: 'TL-LEND-EP1', title: 'Start the lending service', domain_id: 'TL-LEND', file: 'src/main.ts' } });
      await a.ok('link', { source: 'TL-LEND-EP1', relation: 'starts', target: 'TL-LEND-CMD01' });
      expect(await a.ok('show', { id: 'TL-LEND-EP1' })).toContain('Starts TL-LEND-CMD01: Open a loan [starts]');
      // S04: a kind declared twice is refused; in the data files, naming the file and line of each.
      await a.refused('add', { product_kind: { ...HOUSE_KIND, label: 'Start file' } });
      appendFileSync(path.join(a.tl.root, 'data', 'product_kind.jsonl'), `${JSON.stringify({ ...HOUSE_KIND, label: 'Start file' })}\n`);
      expect(found(await a.check(), 'data-refused').join('\n')).toMatch(/data\/product_kind\.jsonl:2:.*line 1/);
    });
  });

  it('LA-AUT-UC05-FL04-T organize a domain\'s use cases into capabilities and patterns through the MCP tools', async () => {
    await walk([...LENDING, add('use_case', { id: 'TL-LEND-UC02', title: 'Return a tool', capability_id: 'TL-LEND-CAP01', goal: 'A member brings a tool back.' })], async (a) => {
      // S01: the domain's capabilities in order; a repeated position is refused.
      await a.ok('add', { capability: { id: 'TL-LEND-CAP02', title: 'Returns', domain_id: 'TL-LEND', position: 2, description: 'Taking tools back from members.' } });
      await a.refused('add', { capability: { id: 'TL-LEND-CAP03', title: 'Fees', domain_id: 'TL-LEND', position: 2, description: 'Charging members for late tools.' } });
      // S02: each use case under its capability.
      await a.ok('move', { id: 'TL-LEND-UC02', parent: 'TL-LEND-CAP02' });
      expect(await a.ok('show', { id: 'TL-LEND-UC02' })).toContain('parent: TL-LEND-CAP02');
      // S03: shared behavior once, as a pattern with its setting and rule.
      await a.ok('add', { pattern: { id: 'TL-PAT-ACT', title: 'Librarian action', product_id: 'TL', description: 'An action a librarian takes that saves a record.' } });
      await a.refused('add', { pattern_setting: { pattern_id: 'TL-PAT-ACT', position: 1, name: 'Record' } });
      await a.ok('add', { pattern_setting: { pattern_id: 'TL-PAT-ACT', position: 1, name: 'record', meaning: 'The record the action saves.' } });
      await a.ok('add', { pattern_rule: { id: 'TL-PAT-ACT-R01', title: 'A saved record reads the same', pattern_id: 'TL-PAT-ACT', statement: 'A record MUST read back as it was saved.' } });
      // S04: each follower links the pattern and answers its settings; the check reports one left unanswered.
      await a.ok('link', { source: 'TL-LEND-UC01', relation: 'follows', target: 'TL-PAT-ACT' });
      await a.ok('link', { source: 'TL-LEND-UC02', relation: 'follows', target: 'TL-PAT-ACT' });
      await a.ok('add', { setting_value: { follower_id: 'TL-LEND-UC01', pattern_id: 'TL-PAT-ACT', setting: 'record', value: 'Loan' } });
      expect(found(await a.check(), 'pattern-setting-missing')).toEqual([expect.stringMatching(/^TL-LEND-UC02: /)]);
      await a.ok('add', { setting_value: { follower_id: 'TL-LEND-UC02', pattern_id: 'TL-PAT-ACT', setting: 'record', value: 'Return' } });
      expect(found(await a.check(), 'pattern-setting-missing')).toEqual([]);
    });
  });

  it('LA-AUT-UC06-FL04-T write a use case\'s flow as ordered steps through the MCP tools', async () => {
    await walk([
      ...LENDING,
      add('uc_requirement', { id: 'TL-LEND-UC01-R02', title: 'The due date is set', use_case_id: 'TL-LEND-UC01', statement: 'The loan MUST be due two weeks after it opens.' }),
      add('use_case', { id: 'TL-LEND-UC02', title: 'Return a tool', capability_id: 'TL-LEND-CAP01', goal: 'A member brings a tool back.' }),
      add('uc_requirement', { id: 'TL-LEND-UC02-R01', title: 'The return is dated', use_case_id: 'TL-LEND-UC02', statement: 'The return MUST carry its date.' }),
      add('view', { id: 'TL-V01', title: 'Loan desk', description: 'Where the librarian opens and closes loans.' }),
    ], async (a) => {
      // S01: the interfaces, then a flow through each of two, its ID ending in the interface's number, and its steps in
      // order on their paths.
      await a.ok('add', { interface: { id: 'TL-IF01', title: 'Loan desk', product_id: 'TL', kind: 'web app', description: 'The desk where librarians lend tools.' } });
      await a.ok('add', { interface: { id: 'TL-IF02', title: 'Lending API', product_id: 'TL', kind: 'API', description: 'The API other systems lend tools through.' } });
      await a.ok('add', { interface: { id: 'TL-IF03', title: 'Librarian tools', product_id: 'TL', kind: 'agent tools', description: 'The tools an agent uses to help the librarian.' } });
      await a.ok('add', { flow: { id: 'TL-LEND-UC01-FL01', title: 'Borrow a tool', use_case_id: 'TL-LEND-UC01', interface_id: 'TL-IF01' } });
      await a.ok('add', { flow: { id: 'TL-LEND-UC01-FL02', title: 'Borrow a tool through the API', use_case_id: 'TL-LEND-UC01', interface_id: 'TL-IF02' } });
      const step = (flow: string, n: string, title: string, pathName: string, position: number) =>
        a.ok('add', { flow_step: { id: `${flow}-${n}`, title, flow_id: flow, path: pathName, position } });
      await step('TL-LEND-UC01-FL01', 'S01', 'The member asks for a tool at the desk', 'main', 1);
      await step('TL-LEND-UC01-FL01', 'S02', 'The librarian opens the loan', 'main', 3);
      await step('TL-LEND-UC01-FL01', 'S03', 'A tool on loan is refused', 'refused', 1);
      await step('TL-LEND-UC01-FL02', 'S01', 'The client opens the loan', 'main', 1);
      // S02: each step's requirements, operation and, in the web app flow, view.
      await a.ok('link', { source: 'TL-LEND-UC01-FL01-S01', relation: 'happens_in', target: 'TL-V01' });
      await a.ok('link', { source: 'TL-LEND-UC01-FL01-S02', relation: 'invokes', target: 'TL-LEND-CMD01' });
      await a.ok('link', { source: 'TL-LEND-UC01-FL01-S03', relation: 'fulfills', target: 'TL-LEND-UC01-R01' });
      await a.ok('link', { source: 'TL-LEND-UC01-FL02-S01', relation: 'invokes', target: 'TL-LEND-CMD01' });
      for (const r of ['R01', 'R02']) await a.ok('link', { source: 'TL-LEND-UC01-FL02-S01', relation: 'fulfills', target: `TL-LEND-UC01-${r}` });
      await a.ok('add', { flow_test: { id: 'TL-LEND-UC01-FL02-T', title: 'Borrow a tool through the API', flow_id: 'TL-LEND-UC01-FL02', level: 'browser', state: 'not automated yet', steps: ['Post a loan for a free tool'], expected_result: 'The loan is opened.' } });
      // S03: a second flow through one interface, a flow ID not ending in its interface's number and a repeated position.
      await a.refused('add', { flow: { id: 'TL-LEND-UC01-FL01', title: 'Again', use_case_id: 'TL-LEND-UC01', interface_id: 'TL-IF01' } });
      await a.refused('add', { flow: { id: 'TL-LEND-UC01-FL03', title: 'Through the wrong interface', use_case_id: 'TL-LEND-UC01', interface_id: 'TL-IF01' } });
      await a.refused('add', { flow_step: { id: 'TL-LEND-UC01-FL01-S04', title: 'Again', flow_id: 'TL-LEND-UC01-FL01', path: 'main', position: 1 } });
      // S04: a view in the API flow, and a requirement of another use case.
      await a.refused('link', { source: 'TL-LEND-UC01-FL02-S01', relation: 'happens_in', target: 'TL-V01' });
      expect(await a.refused('link', { source: 'TL-LEND-UC01-FL01-S01', relation: 'fulfills', target: 'TL-LEND-UC02-R01' })).toContain('step-fulfills-own-use-case');
      // S05: the skipped number, the requirement the flow misses, the API step no endpoint reaches, the flow test at a
      // level its interface does not fit, and the interface no flow goes through, a gap in the product's coverage.
      const checked = await a.check();
      expect(found(checked, 'step-order')).toEqual([expect.stringMatching(/^TL-LEND-UC01-FL01-S02: .*no step has position 2/)]);
      expect(found(checked, 'not-designed')).toContainEqual(expect.stringMatching(/^TL-LEND-UC01-R02: .*TL-LEND-UC01-FL01/));
      expect(found(checked, 'step-without-endpoint')).toEqual([expect.stringMatching(/^TL-LEND-UC01-FL02-S01: /)]);
      expect(found(checked, 'flow-test-level-for-interface')).toEqual([expect.stringMatching(/^TL-LEND-UC01-FL02-T: /)]);
      expect(gaps(checked, 'interface-without-flow')).toEqual(['interface-without-flow TL-IF03']);
      // The Agent fixes each and checks again.
      await a.ok('set', { flow_step: { id: 'TL-LEND-UC01-FL01-S02', position: 2 } });
      await a.ok('link', { source: 'TL-LEND-UC01-FL01-S02', relation: 'fulfills', target: 'TL-LEND-UC01-R02' });
      await a.ok('set', { flow_test: { id: 'TL-LEND-UC01-FL02-T', level: 'system' } });
      await a.ok('add', { flow: { id: 'TL-LEND-UC01-FL03', title: 'Borrow a tool through the librarian tools', use_case_id: 'TL-LEND-UC01', interface_id: 'TL-IF03' } });
      const fixed = await a.check();
      expect(fixed.problems.filter((p) => ['step-order', 'flow-test-level-for-interface'].includes(p.check))).toEqual([]);
      expect(found(fixed, 'not-designed').filter((m) => m.includes('TL-LEND-UC01-FL01'))).toEqual([]);
      expect(gaps(fixed, 'interface-without-flow')).toEqual([]);
    });
  });

  it('LA-AUT-UC07-FL04-T name records in text without linking them through the MCP tools', async () => {
    await walk(LENDING, async (a) => {
      // S01: a record whose text names records of this product and another, one in a code span.
      const text = 'Came from TL-LEND-UC01, as `XX-SHOP-UC09` did in the other product, and from TL-LEND-UC99.';
      await a.ok('set', { uc_requirement: { id: 'TL-LEND-UC01-R01', statement: text } });
      // S02: show returns the text as written; only its links relate it.
      const shown = await a.ok('show', { id: 'TL-LEND-UC01-R01' });
      expect(shown).toContain(`  statement: ${text}`);
      expect(shown).not.toContain('Links:');
      // S03: the check reports nothing about the IDs in text.
      const checked = await a.check();
      expect(checked.problems.filter((p) => /XX-SHOP|UC99/.test(p.message))).toEqual([]);
      expect(checked.errors).toBe(0);
    });
  });

  it('LA-AUT-UC10-FL04-T model each aggregate\'s entities and value objects through the MCP tools', async () => {
    await walk([
      add('domain', { id: 'TL-LEND', title: 'Lending', product_id: 'TL', subdomain_type: 'core', description: 'Lending tools to members and getting them back.' }),
      add('aggregate', { id: 'TL-LEND-A1', title: 'Loan', domain_id: 'TL-LEND', identity: 'Loan ID', description: 'One tool lent to one member, with its return.' }),
      add('aggregate', { id: 'TL-LEND-A2', title: 'Tool', domain_id: 'TL-LEND', identity: 'Tool ID', description: 'A tool the library holds.' }),
    ], async (a) => {
      // S01: the aggregate's root and child entities.
      await a.ok('add', { entity: { id: 'TL-LEND-EN01', title: 'Loan', aggregate_id: 'TL-LEND-A1', role: 'root', description: 'The loan itself.' } });
      await a.ok('add', { entity: { id: 'TL-LEND-EN02', title: 'Renewal', aggregate_id: 'TL-LEND-A1', role: 'child', in_root_table: true, description: 'The loan running longer.' } });
      // S03: the value object with its constraint.
      await a.ok('add', { value_object: { id: 'TL-VO01', title: 'Email address', description: 'Where a member gets mail.' } });
      await a.ok('add', { value_object_field: { value_object_id: 'TL-VO01', position: 1, name: 'Address', meaning: 'The address as typed.', type: 'text', required: true } });
      await a.ok('add', { constraint: { id: 'TL-VO01-C01', title: 'One at sign', value_object_id: 'TL-VO01', statement: 'An email address MUST hold exactly one @.' } });
      // S02: each entity's fields, typed by a basic type, a value object or another aggregate; two types are refused.
      await a.ok('add', { entity_field: { entity_id: 'TL-LEND-EN01', position: 1, name: 'Due date', meaning: 'The last day of the loan.', type: 'date', required: true } });
      await a.ok('add', { entity_field: { entity_id: 'TL-LEND-EN01', position: 2, name: 'Borrower email', meaning: 'Where reminders go.', type_value_object_id: 'TL-VO01', required: true } });
      await a.ok('add', { entity_field: { entity_id: 'TL-LEND-EN01', position: 3, name: 'Tool', meaning: 'The tool lent.', type_aggregate_id: 'TL-LEND-A2', required: true, column_name: 'tool_id' } });
      await a.ok('add', { entity_field: { entity_id: 'TL-LEND-EN02', position: 1, name: 'Renewed on', meaning: 'When the loan was renewed.', type: 'date', required: true } });
      await a.refused('add', { entity_field: { entity_id: 'TL-LEND-EN02', position: 2, name: 'Fee', meaning: 'Two types.', type: 'decimal', type_value_object_id: 'TL-VO01', required: false } });
      // S04: the child is reported until the root reaches it with has_many.
      expect(found(await a.check(), 'entity-unreferenced')).toEqual([expect.stringMatching(/^TL-LEND-EN02: /)]);
      await a.ok('link', { source: 'TL-LEND-EN01', relation: 'has_many', target: 'TL-LEND-EN02' });
      const checked = await a.check();
      expect(found(checked, 'entity-unreferenced')).toEqual([]);
      expect(found(checked, 'value-object-unused')).toEqual([]);
      expect(data(a.tl, 'entity_field').filter((f) => f.entity_id === 'TL-LEND-EN01').map((f) => f.name)).toEqual(['Due date', 'Borrower email', 'Tool']);
    });
  });

  it('LA-AUT-UC12-FL04-T model commands, the events they raise and the policies that hear them through the MCP tools', async () => {
    await walk([
      add('domain', { id: 'TL-LEND', title: 'Lending', product_id: 'TL', subdomain_type: 'core', description: 'Lending tools to members and getting them back.' }),
      add('aggregate', { id: 'TL-LEND-A1', title: 'Loan', domain_id: 'TL-LEND', identity: 'Loan ID', description: 'One tool lent to one member, with its return.' }),
      add('entity', { id: 'TL-LEND-EN01', title: 'Loan', aggregate_id: 'TL-LEND-A1', role: 'root', description: 'The loan itself.' }),
      add('aggregate', { id: 'TL-LEND-A2', title: 'Tool', domain_id: 'TL-LEND', identity: 'Tool ID', description: 'A tool the library holds.' }),
      add('specification', { id: 'TL-LEND-SP01', title: 'Tool is free', statement: 'A tool is free when no active loan names it.' }),
      link('TL-LEND-SP01', 'reads', 'TL-LEND-A1'),
      add('domain_event', { id: 'TL-LEND-EV02', title: 'Tool lent', aggregate_id: 'TL-LEND-A2', published: false, description: 'A tool left the shelf.' }),
    ], async (a) => {
      // S01: the commands, and the event with its field.
      await a.ok('add', { command: { id: 'TL-LEND-CMD01', title: 'Open a loan', entity_id: 'TL-LEND-EN01', description: 'Lends a free tool to a member.' } });
      await a.ok('add', { command: { id: 'TL-LEND-CMD02', title: 'Open a reminder', entity_id: 'TL-LEND-EN01', description: 'Sets a reminder for the loan\'s due date.' } });
      await a.ok('add', { domain_event: { id: 'TL-LEND-EV01', title: 'Loan opened', aggregate_id: 'TL-LEND-A1', published: false, description: 'A tool went out on loan.' } });
      await a.ok('add', { event_field: { domain_event_id: 'TL-LEND-EV01', position: 1, name: 'Loan ID', meaning: 'Which loan.', type_aggregate_id: 'TL-LEND-A1', required: true } });
      // S02: what the command raises and checks; the event other domains hear is published.
      await a.ok('link', { source: 'TL-LEND-CMD01', relation: 'raises', target: 'TL-LEND-EV01' });
      await a.ok('link', { source: 'TL-LEND-CMD01', relation: 'checks', target: 'TL-LEND-SP01' });
      await a.ok('set', { domain_event: { id: 'TL-LEND-EV01', published: true } });
      expect(await a.refused('link', { source: 'TL-LEND-CMD01', relation: 'raises', target: 'TL-LEND-EV02' })).toContain('link-scope');
      // S03: a policy under the command it invokes, hearing one event.
      await a.ok('add', { policy: { id: 'TL-LEND-PO01', title: 'Remind on loan', command_id: 'TL-LEND-CMD02', statement: 'Whenever a loan is opened, the library MUST open its reminder.' } });
      await a.ok('link', { source: 'TL-LEND-PO01', relation: 'hears', target: 'TL-LEND-EV01' });
      expect(await a.ok('show', { id: 'TL-LEND-CMD01' })).toMatch(/Checks TL-LEND-SP01: Tool is free \[checks\]\n {2}Raises TL-LEND-EV01: Loan opened \[raises\]/);
      // S04: the command that must change another aggregate records it, and the check lists it apart.
      await a.ok('add', { command_change: { command_id: 'TL-LEND-CMD01', aggregate_id: 'TL-LEND-A2', reason: 'The tool must never show as lent without its loan.' } });
      expect((await a.check()).exceptions).toEqual([{ command: 'TL-LEND-CMD01', aggregate: 'TL-LEND-A2', reason: 'The tool must never show as lent without its loan.' }]);
    });
  });

  it('LA-AUT-UC13-FL04-T write the test plan, one test kind per thing tested, through the MCP tools', async () => {
    await walk([
      ...LENDING,
      add('invariant', { id: 'TL-LEND-INV01', title: 'One active loan per tool', aggregate_id: 'TL-LEND-A1', statement: 'A tool MUST NOT have two active loans.' }),
      add('uc_requirement', { id: 'TL-LEND-UC01-R02', title: 'A member in debt is refused', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse a member who owes a fee.' }),
    ], async (a) => {
      a.tl.write('test/loans.test.ts', "it('TL-LEND-INV01-T one active loan per tool');\nit('TL-LEND-UC01-R01-T01 a tool on loan is refused');\n");
      // S01: each test under the record it tests, of the kind named after it, with its run by.
      await a.ok('add', { invariant_test: { id: 'TL-LEND-INV01-T', title: 'One active loan per tool', invariant_id: 'TL-LEND-INV01', level: 'integration', state: 'automated', file: 'test/loans.test.ts', when: 'A second loan opens for a tool on an active loan', then: 'It is refused' } });
      await a.ok('add', { use_case_test: { id: 'TL-LEND-UC01-R01-T01', title: 'A tool on loan is refused', uc_requirement_id: 'TL-LEND-UC01-R01', level: 'service', state: 'automated', file: 'test/loans.test.ts', when: 'A member borrows a tool that is on loan', then: 'The loan is refused' } });
      await a.refused('add', { use_case_test: { id: 'TL-LEND-INV01-T01', title: 'Under the wrong kind', uc_requirement_id: 'TL-LEND-INV01', level: 'service', state: 'not automated yet', when: 'A second loan opens', then: 'It is refused' } });
      // S02: the requirements sorted into a group.
      await a.ok('set', { uc_requirement: { id: 'TL-LEND-UC01-R01', group_name: 'Refusals' } });
      await a.ok('set', { uc_requirement: { id: 'TL-LEND-UC01-R02', group_name: 'Refusals' } });
      expect(data(a.tl, 'uc_requirement').map((r) => r.group_name)).toEqual(['Refusals', 'Refusals']);
      // S03: the data set the tests start from, reported until a test starts from it and its file exists.
      await a.ok('add', { test_data_set: { id: 'TL-LEND-TD01', title: 'One tool on loan', domain_id: 'TL-LEND', environment: 'The test database.', records: 'One member, one tool on loan.', prepare: 'Run the seed.', reset: 'Drop the database.', file: 'test/seed.ts', description: 'A tool already lent, for the tests that refuse a second loan.' } });
      expect(found(await a.check(), 'test-data-set-unused')).toEqual([expect.stringMatching(/^TL-LEND-TD01: /)]);
      await a.ok('link', { source: 'TL-LEND-INV01-T', relation: 'starts_from', target: 'TL-LEND-TD01' });
      const linked = await a.check();
      expect(found(linked, 'test-data-set-unused')).toEqual([]);
      expect(linked.problems.filter((p) => p.check === 'test-data-set-file-missing').map((p) => [p.severity, p.record])).toEqual([['error', 'TL-LEND-TD01']]);
      a.tl.write('test/seed.ts', '// One member, one tool on loan.\n');
      expect(found(await a.check(), 'test-data-set-file-missing')).toEqual([]);
    });
  });

  it('LA-AUT-UC16-FL04-T write the engineering standards the code follows through the MCP tools', async () => {
    await walk([...LENDING, add('command_handler', { id: 'TL-LEND-CMD01-H', title: 'openLoan', command_id: 'TL-LEND-CMD01', file: 'src/loans.ts', description: 'Opens the loan in one transaction.' })], async (a) => {
      a.tl.write('src/loans.ts', '// TL-LEND-CMD01-H\n');
      a.tl.write('test/standards.test.ts', "it('TL-STD-LOG-R01-T01 no console.log in src');\n");
      // S01: a standard and its rule.
      await a.ok('add', { standard: { id: 'TL-STD-LOG', title: 'Logging', product_id: 'TL', description: 'How the code logs what it does.' } });
      await a.ok('add', { standard_rule: { id: 'TL-STD-LOG-R01', title: 'No console.log', standard_id: 'TL-STD-LOG', statement: 'Code MUST log through the logger, never console.log.' } });
      // S02: the technical record that meets it, and the test that proves it.
      await a.ok('link', { source: 'TL-LEND-CMD01-H', relation: 'meets', target: 'TL-STD-LOG-R01' });
      await a.ok('add', { standard_rule_test: { id: 'TL-STD-LOG-R01-T01', title: 'No console.log in src', standard_rule_id: 'TL-STD-LOG-R01', level: 'unit', state: 'automated', file: 'test/standards.test.ts', when: 'The test reads every file under src', then: 'No file calls console.log' } });
      // S03: the standard with its rule, what meets it and its test.
      expect(await a.ok('show', { id: 'TL-STD-LOG' })).toContain('TL-STD-LOG-R01 (standard_rule): No console.log');
      const rule = await a.ok('show', { id: 'TL-STD-LOG-R01' });
      expect(rule).toContain('TL-LEND-CMD01-H: openLoan [meets, in]');
      expect(rule).toContain('TL-STD-LOG-R01-T01 (standard_rule_test): No console.log in src');
    });
  });

  it('LA-AUT-UC17-FL04-T write the technical records that build the design through the MCP tools', async () => {
    await walk([
      ...LENDING,
      add('invariant', { id: 'TL-LEND-INV01', title: 'One active loan per tool', aggregate_id: 'TL-LEND-A1', statement: 'A tool MUST NOT have two active loans.' }),
      { op: 'add', table: 'entity_field', row: { entity_id: 'TL-LEND-EN01', position: 2, name: 'Tool ID', meaning: 'The tool lent.', type: 'text', required: true } },
    ], async (a) => {
      // S01: the technical records under the design records they implement, naming their file.
      await a.ok('add', { command_handler: { id: 'TL-LEND-CMD01-H', title: 'openLoan', command_id: 'TL-LEND-CMD01', file: 'src/loans.ts', description: 'Opens the loan in one transaction.' } });
      await a.ok('add', { repository: { id: 'TL-LEND-REPO01', title: 'Loans', domain_id: 'TL-LEND', file: 'src/loans.ts', description: 'Keeps loans in one table and reads them by tool.' } });
      await a.ok('link', { source: 'TL-LEND-REPO01', relation: 'persists', target: 'TL-LEND-A1' });
      expect(found(await a.check(), 'technical-file-missing').sort()).toEqual([expect.stringMatching(/^TL-LEND-CMD01-H: /), expect.stringMatching(/^TL-LEND-REPO01: /)]);
      a.tl.write('src/loans.ts', '// TL-LEND-CMD01-H TL-LEND-REPO01\n');
      // S02: the entity's table with its keys, the unique key naming the invariant it enforces.
      await a.ok('add', { table: { id: 'TL-LEND-EN01-TB', title: 'Loans', entity_id: 'TL-LEND-EN01', name: 'loan', storage: 'table', file: 'src/loans.ts' } });
      await a.ok('add', { table_key: { table_id: 'TL-LEND-EN01-TB', position: 1, type: 'primary', columns: ['id'] } });
      await a.ok('add', { table_key: { table_id: 'TL-LEND-EN01-TB', position: 2, type: 'unique', columns: ['tool_id'], invariant_id: 'TL-LEND-INV01', condition: 'returned_at IS NULL' } });
      await a.refused('add', { table_key: { table_id: 'TL-LEND-EN01-TB', position: 3, type: 'index', columns: ['tool_id'], invariant_id: 'TL-LEND-INV01' } });
      expect(found(await a.check(), 'technical-file-missing')).toEqual([]);
      expect(data(a.tl, 'table_key').map((k) => [k.type, k.invariant_id ?? null])).toEqual([['primary', null], ['unique', 'TL-LEND-INV01']]);
    });
  });

  it('LA-AUT-UC18-FL04-T write the views, endpoints and integrations a flow reaches through the MCP tools', async () => {
    await walk([
      ...LENDING,
      add('interface', { id: 'TL-IF01', title: 'Loan desk', product_id: 'TL', kind: 'web app', description: 'The desk where librarians lend tools.' }),
      add('flow', { id: 'TL-LEND-UC01-FL01', title: 'Borrow a tool', use_case_id: 'TL-LEND-UC01', interface_id: 'TL-IF01' }),
      add('flow_step', { id: 'TL-LEND-UC01-FL01-S01', title: 'The member borrows a tool', flow_id: 'TL-LEND-UC01-FL01', path: 'main', position: 1 }),
    ], async (a) => {
      // S01: an endpoint under the command it exposes.
      await a.ok('add', { endpoint: { id: 'TL-LEND-EP01', title: 'POST /loans', command_id: 'TL-LEND-CMD01', method: 'POST', route: '/loans', description: 'Opens a loan from the desk.' } });
      // S02: view requirements under views and API requirements under endpoints.
      await a.ok('add', { view: { id: 'TL-V01', title: 'Loan desk', route: '/loans', description: 'Where the librarian opens and closes loans.' } });
      await a.ok('add', { view_requirement: { id: 'TL-V01-R01', title: 'The due date shows', view_id: 'TL-V01', statement: 'The desk MUST show the loan\'s due date.' } });
      await a.ok('add', { api_requirement: { id: 'TL-LEND-EP01-R01', title: 'A tool on loan is refused', endpoint_id: 'TL-LEND-EP01', statement: 'The endpoint MUST answer 409 for a tool on loan.' } });
      await a.ok('add', { integration: { id: 'TL-INT01', title: 'Mail', system: 'The mail service', description: 'Sends the library\'s mail to members.' } });
      // S03: the check reports the view and integration nothing uses, until a step links them.
      const unused = await a.check();
      expect([...found(unused, 'view-unused'), ...found(unused, 'integration-unused')]).toEqual([expect.stringMatching(/^TL-V01: /), expect.stringMatching(/^TL-INT01: /)]);
      await a.ok('link', { source: 'TL-LEND-UC01-FL01-S01', relation: 'happens_in', target: 'TL-V01' });
      await a.ok('link', { source: 'TL-LEND-UC01-FL01-S01', relation: 'exchanges_with', target: 'TL-INT01' });
      await a.ok('link', { source: 'TL-LEND-UC01-FL01-S01', relation: 'invokes', target: 'TL-LEND-CMD01' });
      expect((await a.check()).problems.filter((p) => p.severity === 'error')).toEqual([]);
    });
  });

  it('LA-AUT-UC20-FL04-T sort a domain\'s rules by what they do through the MCP tools', async () => {
    await walk([
      ...LENDING,
      add('read_model', { id: 'TL-LEND-RM01', title: 'Free tools', domain_id: 'TL-LEND', description: 'The tools on no active loan.' }),
      add('query', { id: 'TL-LEND-QRY01', title: 'List free tools', read_model_id: 'TL-LEND-RM01', description: 'The free tools, by name.' }),
      add('value_object', { id: 'TL-VO01', title: 'Email address', description: 'Where a member gets mail.' }),
      { op: 'add', table: 'value_object_field', row: { value_object_id: 'TL-VO01', position: 1, name: 'Address', meaning: 'The address as typed.', type: 'text', required: true } },
      { op: 'add', table: 'entity_field', row: { entity_id: 'TL-LEND-EN01', position: 2, name: 'Borrower email', meaning: 'Where reminders go.', type_value_object_id: 'TL-VO01', required: true } },
      add('table', { id: 'TL-LEND-EN01-TB', title: 'Loans', entity_id: 'TL-LEND-EN01', name: 'loan', storage: 'table' }),
    ], async (a) => {
      // S01: the value format as a constraint of its value object.
      await a.ok('add', { constraint: { id: 'TL-VO01-C01', title: 'One at sign', value_object_id: 'TL-VO01', statement: 'An email address MUST hold exactly one @.' } });
      // S02: the rule of one aggregate as its invariant, named on the unique key that enforces it.
      await a.ok('add', { invariant: { id: 'TL-LEND-INV01', title: 'One loan per number', aggregate_id: 'TL-LEND-A1', statement: 'No two loans MUST share a number.' } });
      await a.ok('add', { table_key: { table_id: 'TL-LEND-EN01-TB', position: 1, type: 'unique', columns: ['id'], invariant_id: 'TL-LEND-INV01' } });
      // S03: the check across aggregates as a specification, reported until linked.
      await a.ok('add', { specification: { id: 'TL-LEND-SP01', title: 'Tool is free', statement: 'A tool is free when no active loan names it.' } });
      expect(found(await a.check(), 'specification-unused')).toEqual([expect.stringMatching(/^TL-LEND-SP01: /)]);
      await a.ok('link', { source: 'TL-LEND-SP01', relation: 'reads', target: 'TL-LEND-A1' });
      await a.ok('link', { source: 'TL-LEND-CMD01', relation: 'checks', target: 'TL-LEND-SP01' });
      await a.ok('link', { source: 'TL-LEND-QRY01', relation: 'selects_by', target: 'TL-LEND-SP01' });
      expect(found(await a.check(), 'specification-unused')).toEqual([]);
    });
  });

  it('LA-AUT-UC21-FL04-T model read models, queries, domain services and terms through the MCP tools', async () => {
    await walk(LENDING, async (a) => {
      // S01: the read model with its fields, the aggregate it reads, and its query; another domain's query is refused.
      await a.ok('add', { read_model: { id: 'TL-LEND-RM01', title: 'Loans by member', domain_id: 'TL-LEND', description: 'Each member\'s open loans.' } });
      await a.ok('add', { read_model_field: { read_model_id: 'TL-LEND-RM01', position: 1, name: 'Loan', meaning: 'Which loan.', type_aggregate_id: 'TL-LEND-A1', required: true } });
      await a.ok('link', { source: 'TL-LEND-RM01', relation: 'reads', target: 'TL-LEND-A1' });
      await a.ok('add', { query: { id: 'TL-LEND-QRY01', title: 'List a member\'s loans', read_model_id: 'TL-LEND-RM01', description: 'One member\'s loans, the latest first.' } });
      await a.refused('add', { query: { id: 'TL-SHOP-QRY01', title: 'Another domain\'s query', read_model_id: 'TL-LEND-RM01', description: 'A query filed under the wrong domain.' } });
      // S02: a domain service the query calls, and a term.
      await a.ok('add', { domain_service: { id: 'TL-LEND-DS01', title: 'Late fee', domain_id: 'TL-LEND', statement: 'The fee MUST be a day rate times the days late.' } });
      await a.ok('link', { source: 'TL-LEND-QRY01', relation: 'calls', target: 'TL-LEND-DS01' });
      await a.ok('add', { term: { id: 'TL-LEND-TM01', title: 'Loan', domain_id: 'TL-LEND', meaning: 'One tool lent to one member until it is returned.' } });
      const shown = await a.ok('show', { id: 'TL-LEND' });
      for (const id of ['TL-LEND-RM01', 'TL-LEND-DS01', 'TL-LEND-TM01']) expect(shown).toContain(id);
      expect((await a.check()).errors).toBe(0);
    });
  });

  it('LA-AUT-UC22-FL04-T write the business outcomes the product exists to achieve through the MCP tools', async () => {
    await walk(LENDING, async (a) => {
      // S01: a measurable outcome under the product; one without its measure is refused.
      expect(await a.ok('next_id', { kind: 'business_outcome', parent: 'TL' })).toBe('TL-BO01');
      await a.refused('add', { business_outcome: { id: 'TL-BO01', title: 'More tools in use', product_id: 'TL', statement: 'Members borrow more tools.', target: 'Twice as many.' } });
      await a.ok('add', { business_outcome: { id: 'TL-BO01', title: 'More tools in use', product_id: 'TL', statement: 'Members borrow the library\'s tools more often.', measure: 'Loans opened per tool per month.', target: 'Two per tool per month within a year.' } });
      // S02: the capability that serves it.
      await a.ok('link', { source: 'TL-LEND-CAP01', relation: 'serves', target: 'TL-BO01' });
      // S03: the test that measures it.
      await a.ok('add', { use_case_test: { id: 'TL-LEND-UC01-R01-T01', title: 'Loans are counted per tool', uc_requirement_id: 'TL-LEND-UC01-R01', level: 'service', state: 'not automated yet', when: 'Members borrow tools for a month', then: 'The loans are counted per tool' } });
      await a.ok('link', { source: 'TL-BO01', relation: 'measured_by', target: 'TL-LEND-UC01-R01-T01' });
      const shown = await a.ok('show', { id: 'TL-BO01' });
      expect(shown).toContain('Served by TL-LEND-CAP01');
      expect(shown).toContain('Measured by TL-LEND-UC01-R01-T01');
    });
  });
});

describe('Checking flows through the MCP tools', () => {
  it('LA-CHK-UC02-FL04-T add a check through the MCP tools', async () => {
    await walk([...LENDING, add('aggregate', { id: 'TL-LEND-A2', title: 'Tool', domain_id: 'TL-LEND', identity: 'Tool ID', description: 'A tool the library holds.' })], async (a) => {
      // S01: the check as one row through the command layer.
      expect(await a.ok('add', { check: NO_COMMAND })).toContain('Added check aggregate-without-command');
      expect(a.tl.read('data/check.jsonl')).toContain('"name":"aggregate-without-command"');
      // S02: the check tool runs it among the others.
      expect(found(await a.check(), 'aggregate-without-command')).toEqual(['TL-LEND-A2: Aggregate TL-LEND-A2 has no command.']);
    });
  });

  it('LA-CHK-UC04-FL04-T find structural problems through the MCP tools', async () => {
    // Stages written at different times: a view nothing uses yet, a use case with no flow, a test at a level its kind
    // does not allow, and a policy hearing an event of a stored aggregate that is delivered in process.
    await walk([
      ...LENDING,
      add('table', { id: 'TL-LEND-EN01-TB', title: 'Loans', entity_id: 'TL-LEND-EN01', name: 'loan', storage: 'table' }),
      add('aggregate', { id: 'TL-LEND-A2', title: 'Tool', domain_id: 'TL-LEND', identity: 'Tool ID', description: 'A tool the library holds.' }),
      add('command', { id: 'TL-LEND-CMD02', title: 'Open a reminder', entity_id: 'TL-LEND-EN01', description: 'Sets a reminder for the loan\'s due date.' }),
      { op: 'add', table: 'command_change', row: { command_id: 'TL-LEND-CMD01', aggregate_id: 'TL-LEND-A2', reason: 'The tool must never show as lent without its loan.' } },
      add('policy', { id: 'TL-LEND-PO01', title: 'Remind on loan', command_id: 'TL-LEND-CMD02', statement: 'Whenever a loan is opened, the library MUST open its reminder.' }),
      link('TL-LEND-PO01', 'hears', 'TL-LEND-EV01'),
      add('event_type', { id: 'TL-LEND-EV01-ET', title: 'LoanOpened', domain_event_id: 'TL-LEND-EV01', delivery: 'in process' }),
      add('view', { id: 'TL-V01', title: 'Loan page', description: 'Shows one loan and its due date.' }),
      add('use_case_test', { id: 'TL-LEND-UC01-R01-T01', title: 'A tool on loan is refused', uc_requirement_id: 'TL-LEND-UC01-R01', level: 'integration', state: 'not automated yet', when: 'A member borrows a tool that is on loan', then: 'The loan is refused' }),
    ], async (a) => {
      // S01, S03: the check tool on the product; what nothing uses is an error.
      const checked = await a.check();
      expect(found(checked, 'view-unused')).toEqual([expect.stringMatching(/^TL-V01: /)]);
      expect(checked.problems.find((p) => p.check === 'view-unused')!.severity).toBe('error');
      // S04: the shape warnings, the recorded exception listed apart, and the use case with no flow a gap in its domain's
      // coverage, never a problem.
      expect(found(checked, 'test-level-not-allowed')).toEqual([expect.stringMatching(/^TL-LEND-UC01-R01-T01: /)]);
      expect(found(checked, 'event-not-by-outbox')).toEqual([expect.stringMatching(/^TL-LEND-EV01: /)]);
      expect(checked.exceptions).toEqual([expect.objectContaining({ command: 'TL-LEND-CMD01', aggregate: 'TL-LEND-A2' })]);
      expect(checked.problems.map((p) => p.record)).not.toContain('TL-LEND-CMD01');
      expect(checked.products[0].coverage.find((c) => c.domain === 'TL-LEND')!.gaps).toContainEqual(expect.objectContaining({ id: 'TL-LEND-UC01', missing: 'use-case-without-flow' }));
      expect(found(checked, 'use-case-without-flow')).toEqual([]);
      // S05: the Agent fixes the error and the warnings, and calls the check tool again.
      await a.ok('remove', { id: 'TL-V01' });
      await a.ok('set', { use_case_test: { id: 'TL-LEND-UC01-R01-T01', level: 'service' } });
      await a.ok('set', { event_type: { id: 'TL-LEND-EV01-ET', delivery: 'outbox' } });
      expect((await a.check()).problems.filter((p) => ['view-unused', 'test-level-not-allowed', 'event-not-by-outbox'].includes(p.check))).toEqual([]);
      // S02: a test given its parent's ID is refused once, naming its rule, file and line, and nothing that follows from it.
      appendFileSync(path.join(a.tl.root, 'data', 'use_case_test.jsonl'), '{"id":"TL-LEND-UC01-R01","title":"Given its parent\'s ID","uc_requirement_id":"TL-LEND-UC01-R01","level":"service","state":"not automated yet","when":"A member borrows a tool that is on loan","then":"The loan is refused"}\n');
      const refused = await a.check();
      expect(refused.problems).toHaveLength(1);
      expect(refused.problems[0]).toMatchObject({ severity: 'error', check: 'data-refused' });
      expect(refused.problems[0].message).toMatch(/^data\/use_case_test\.jsonl:2: .*\[[a-z-]+\]$/);
    });
  });

  it('LA-CHK-UC05-FL04-T add a product\'s own checks through the MCP tools', async () => {
    await walk([...LENDING, add('aggregate', { id: 'TL-LEND-A2', title: 'Tool', domain_id: 'TL-LEND', identity: 'Tool ID', description: 'A tool the library holds.' })], async (a) => {
      // S02: a house rule as a check row with the product's product_id.
      await a.ok('add', { check: NO_COMMAND });
      expect(a.tl.read('data/check.jsonl')).toContain('"product_id":"TL"');
      // S03: Lathe's checks run first, then the product's, its problems carrying its row's name.
      const checked = await a.check();
      const names = checked.problems.map((p) => p.check);
      expect(found(checked, 'aggregate-without-command')).toEqual(['TL-LEND-A2: Aggregate TL-LEND-A2 has no command.']);
      expect(names.lastIndexOf('aggregate-without-command')).toBe(names.length - 1);
      // S04: the Agent fixes what it finds and checks again.
      await a.ok('add', { entity: { id: 'TL-LEND-EN09', title: 'Tool', aggregate_id: 'TL-LEND-A2', role: 'root', description: 'A tool on the shelf or out.' } });
      await a.ok('add', { command: { id: 'TL-LEND-CMD02', title: 'Add a tool', entity_id: 'TL-LEND-EN09', description: 'Puts a named tool in the catalog.' } });
      expect(found(await a.check(), 'aggregate-without-command')).toEqual([]);
      // S05: a check named like one of Lathe's is refused, naming lathe/data/check.jsonl.
      expect(await a.refused('add', { check: { ...NO_COMMAND, name: 'view-unused' } })).toContain('lathe/data/check.jsonl');
      // S06: a product check whose query fails is an error naming it, and the other checks still run.
      await a.ok('add', { check: { ...NO_COMMAND, name: 'broken-house-rule', position: 2, query: 'SELECT id AS record, title AS message FROM no_such_table' } });
      await a.ok('add', { view: { id: 'TL-V01', title: 'Loan page', description: 'Shows one loan and its due date.' } });
      const failing = await a.check();
      expect(failing.problems.filter((p) => p.message.includes('broken-house-rule')).map((p) => p.severity)).toEqual(['error']);
      expect(found(failing, 'view-unused')).toHaveLength(1);
      // S07: a checks key in lathe.config.json is refused as an unknown setting.
      a.tl.write('lathe.config.json', '{ "checks": [] }\n');
      const config = await a.server.call('check', {});
      expect(JSON.stringify(config)).toContain('unknown setting \\"checks\\"');
    });
  });

  it('LA-CHK-UC06-FL04-T keep each level of the spec a useful size through the MCP tools', async () => {
    await walk([
      ...LENDING,
      add('entity', { id: 'TL-LEND-EN02', title: 'Return', aggregate_id: 'TL-LEND-A1', role: 'child', in_root_table: true, description: 'The tool coming back.' }),
      add('entity', { id: 'TL-LEND-EN03', title: 'Renewal', aggregate_id: 'TL-LEND-A1', role: 'child', in_root_table: true, description: 'The loan running longer.' }),
      link('TL-LEND-EN01', 'has_many', 'TL-LEND-EN02'),
      link('TL-LEND-EN01', 'has_many', 'TL-LEND-EN03'),
      add('uc_requirement', { id: 'TL-LEND-UC01-R02', title: 'A member in debt is refused', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse a member who owes a fee.' }),
      add('uc_requirement', { id: 'TL-LEND-UC01-R03', title: 'A tool in repair is refused', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse a tool in repair.' }),
      add('uc_requirement', { id: 'TL-LEND-UC01-R04', title: 'The due date is set', use_case_id: 'TL-LEND-UC01', statement: 'The loan MUST be due two weeks after it opens.', group_name: 'Dates' }),
    ], async (a) => {
      // S01: the product's limits.
      await a.ok('add', { product_setting: { product_id: 'TL', max_children: 2, max_entities_per_aggregate: 2 } });
      // S02, S03: too many children, too many entities, and a capability and a group with one child.
      const checked = await a.check();
      expect(found(checked, 'too-many-children').sort()).toEqual([expect.stringMatching(/^TL-LEND-A1: .*3 children of kind entity/), expect.stringMatching(/^TL-LEND-UC01: .*3 /)]);
      expect(found(checked, 'aggregate-too-large')).toEqual([expect.stringMatching(/^TL-LEND-A1: /)]);
      expect(found(checked, 'lone-child').sort()).toEqual([expect.stringMatching(/^TL-LEND-CAP01: /), expect.stringMatching(/^TL-LEND-UC01: .*"Dates"/)]);
      // S04: the Agent raises the limits, adds a use case, clears the group and checks again.
      await a.ok('set', { product_setting: { product_id: 'TL', max_children: 15, max_entities_per_aggregate: 7 } });
      await a.ok('add', { use_case: { id: 'TL-LEND-UC02', title: 'Return a tool', capability_id: 'TL-LEND-CAP01', goal: 'A member brings a tool back.' } });
      await a.ok('set', { uc_requirement: { id: 'TL-LEND-UC01-R04', group_name: null } });
      expect((await a.check()).problems.filter((p) => ['too-many-children', 'aggregate-too-large', 'lone-child'].includes(p.check))).toEqual([]);
    });
  });
});
