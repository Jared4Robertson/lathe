// The stage domains' and Checking's flows through the MCP tools (LA-IF04), each walked through a real `lathe mcp` server, as
// the plugin starts it, on a temporary product: the Agent writes and reads with one tool per aggregate command and
// query (domain_add_domain, use_case_move_use_case, standard_get_standard), and checks with check. The same flows
// through the CLI are in authoring.test.ts and checking.test.ts.
import { appendFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { add, LATHE_DIR, LENDING, link, mcp, product, removeProducts, type Product, type Seed } from './product.ts';

afterAll(removeProducts);

interface Problem { severity: string; check: string; record: string | null; message: string }
interface Gap { id: string; kind: string; missing: string; message: string }
interface Checked {
  errors: number;
  warnings: number;
  problems: Problem[];
  products: { root: string; coverage: { domain: string | null; gaps: Gap[] }[] }[];
}

/** A product seeded with the rows, and an MCP server on it; `walk` closes the server when the flow is done. */
async function agent(seed: Seed[] = []) {
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
async function walk(seed: Seed[], flow: (a: Agent) => Promise<void>) {
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
/** A tool's input schema, as tools/list gives it. */
const schemaOf = async (a: Agent, name: string) => JSON.stringify((await a.server.request('tools/list')).result!.tools!.find((t) => t.name === name)!.inputSchema);

/** A product kind several flows declare. */
const HOUSE_KIND = { name: 'launcher', product_id: 'TL', label: 'Launcher', description: 'A file the product starts from.', parent_kind: 'domain', stage: 'technical-specification', obligation: false, complexity: 'accidental' };
const NO_COMMAND = {
  name: 'aggregate-without-command',
  product_id: 'TL',
  domain_id: 'LA-CHK',
  position: 1,
  severity: 'warning',
  summary: 'An aggregate with no command.',
  explanation: 'Each aggregate of this product is changed by at least one command of its own.',
  query: "SELECT a.id AS record, 'Aggregate ' || a.id || ' has no command.' AS message FROM aggregate a WHERE NOT EXISTS (SELECT 1 FROM command c JOIN entity e ON e.id = c.entity_id WHERE e.aggregate_id = a.id) ORDER BY record",
};

describe('The stage domains\' flows through the MCP tools', () => {
  it('LA-PAT-MCP-STEPS-R01-T01 LA-PAT-MCP-STEPS-R01-T05 LA-PAT-MCP-STEPS-R01-T06 LA-PAT-MCP-STEPS-R01-T07 LA-PAT-MCP-STEPS-R01-T08 LA-PAT-MCP-STEPS-R01-T09 split a product into domains through the MCP tools', async () => {
    await walk([], async (a) => {
      // S01: the modeling skill's first step is to find the product's business capabilities.
      const skill = readFileSync(path.join(LATHE_DIR, '..', 'plugin', 'skills', 'model-a-domain', 'SKILL.md'), 'utf8');
      expect(skill).toMatch(/Before you write any record, find the product's business capabilities and make each one a domain/);
      // S02: the Add a domain tool gives the domain's fields from the schema, its subdomain type among them.
      const addDomain = await schemaOf(a, 'domain_add_domain');
      expect(addDomain).toContain('subdomain_type');
      expect(addDomain).toContain('supporting');
      // S03: one domain per capability, with its subdomain type; one is named for a layer.
      await a.ok('domain_add_domain', { id: 'TL-LEND', title: 'Lending', product_id: 'TL', position: 1, subdomain_type: 'core', description: 'Lending tools to members and getting them back.' });
      await a.ok('domain_add_domain', { id: 'TL-CAT', title: 'Web app', product_id: 'TL', position: 2, subdomain_type: 'supporting', description: 'The tools the library holds and how members find them.' });
      // S04: the check warns of the domain named for a technology; the Agent renames it.
      expect(found(await a.check(), 'domain-named-for-technology')).toEqual([expect.stringMatching(/^TL-CAT: .*"web app"/)]);
      await a.ok('domain_change_domain', { id: 'TL-CAT', title: 'Catalog' });
      expect(found(await a.check(), 'domain-named-for-technology')).toEqual([]);
      // A refused command returns every reason and changes no file.
      const before = a.tl.read('data/domain.jsonl');
      expect(await a.refused('domain_add_domain', { id: 'TL-SHOP', title: 'Shop', product_id: 'TL', position: 3, subdomain_type: 'central', description: 'Selling tools to members.' })).toContain('subdomain_type');
      expect(a.tl.read('data/domain.jsonl')).toBe(before);
    });
  });

  it('LA-PAT-MCP-STEPS-R01-T01 LA-PAT-MCP-STEPS-R01-T05 LA-PAT-MCP-STEPS-R01-T06 LA-PAT-MCP-STEPS-R01-T07 LA-PAT-MCP-STEPS-R01-T08 LA-PAT-MCP-STEPS-R01-T09 declare a product\'s own kinds and relations through the MCP tools', async () => {
    await walk(LENDING, async (a) => {
      const launcher = { kind: 'launcher', id: 'TL-LEND-EP1', parent_id: 'TL-LEND', values: { title: 'Start the lending service', file: 'src/main.ts' } };
      await a.refused('extension_record_add_extension_record', launcher);
      // S01: a product kind with its fields, in a stage.
      await a.ok('product_declare_product_kind', { ...HOUSE_KIND, fields: [{ name: 'file', type: 'text', required: true, description: 'The file it starts from.' }] });
      // S02: a new relation.
      await a.ok('product_declare_product_relation', { name: 'starts', source_kind: 'launcher', target_kind: 'command', product_id: 'TL', forward_label: 'Starts', reverse_label: 'Started by', description: 'The launcher starts the command.' });
      // S03: the server announces its tools again, and the Extension record's tools take the new kind.
      expect(a.server.notifications).toContain('notifications/tools/list_changed');
      await a.ok('extension_record_add_extension_record', { ...launcher, links: { starts: ['TL-LEND-CMD01'] } });
      expect(data(a.tl, 'starts')).toEqual([{ source_id: 'TL-LEND-EP1', target_id: 'TL-LEND-CMD01' }]);
      expect(await a.ok('extension_record_get_extension_record', { id: 'TL-LEND-EP1' })).toContain('TL-LEND-CMD01');
      // S04: a kind declared twice is refused; in the data files, naming the file and line of each.
      await a.refused('product_declare_product_kind', { ...HOUSE_KIND, label: 'Start file' });
      appendFileSync(path.join(a.tl.root, 'data', 'product_kind.jsonl'), `${JSON.stringify({ ...HOUSE_KIND, label: 'Start file' })}\n`);
      expect(found(await a.check(), 'data-refused').join('\n')).toMatch(/data\/product_kind\.jsonl:2:.*line 1/);
    });
  });

  it('LA-PAT-MCP-STEPS-R01-T01 LA-PAT-MCP-STEPS-R01-T05 LA-PAT-MCP-STEPS-R01-T06 LA-PAT-MCP-STEPS-R01-T07 LA-PAT-MCP-STEPS-R01-T08 LA-PAT-MCP-STEPS-R01-T09 organize a domain\'s use cases into capabilities and patterns through the MCP tools', async () => {
    await walk([...LENDING, add('use_case', { id: 'TL-LEND-UC02', title: 'Return a tool', capability_id: 'TL-LEND-CAP01', goal: 'A member brings a tool back.' })], async (a) => {
      // S01: the domain's capabilities in order; a repeated position is refused.
      await a.ok('domain_add_capability', { id: 'TL-LEND-CAP02', title: 'Returns', domain_id: 'TL-LEND', position: 2, description: 'Taking tools back from members.' });
      await a.refused('domain_add_capability', { id: 'TL-LEND-CAP03', title: 'Fees', domain_id: 'TL-LEND', position: 2, description: 'Charging members for late tools.' });
      // S02: each use case under its capability.
      await a.ok('use_case_move_use_case', { id: 'TL-LEND-UC02', capability_id: 'TL-LEND-CAP02' });
      expect(data(a.tl, 'use_case').find((u) => u.id === 'TL-LEND-UC02').capability_id).toBe('TL-LEND-CAP02');
      // S03: shared behavior once, as a pattern with its setting and rule.
      const pattern = { id: 'TL-PAT-ACT', title: 'Librarian action', product_id: 'TL', description: 'An action a librarian takes that saves a record.' };
      await a.refused('pattern_add_pattern', { ...pattern, settings: [{ name: 'Record', meaning: 'The record the action saves.' }] });
      await a.ok('pattern_add_pattern', { ...pattern, settings: [{ name: 'record', meaning: 'The record the action saves.' }] });
      await a.ok('pattern_add_pattern_rule', { id: 'TL-PAT-ACT-R01', title: 'A saved record reads the same', pattern_id: 'TL-PAT-ACT', statement: 'A record MUST read back as it was saved.' });
      // S04: each follower follows the pattern and gives its settings; the check reports one left without a value.
      await a.ok('pattern_following_follow_pattern', { follower_id: 'TL-LEND-UC01', pattern_id: 'TL-PAT-ACT', setting_values: [{ setting: 'record', value: 'Loan' }] });
      await a.ok('pattern_following_follow_pattern', { follower_id: 'TL-LEND-UC02', pattern_id: 'TL-PAT-ACT' });
      expect(found(await a.check(), 'pattern-setting-missing')).toEqual([expect.stringMatching(/^TL-LEND-UC02: /)]);
      await a.ok('pattern_following_change_setting_values', { follower_id: 'TL-LEND-UC02', pattern_id: 'TL-PAT-ACT', setting_values: [{ setting: 'record', value: 'Return' }] });
      expect(found(await a.check(), 'pattern-setting-missing')).toEqual([]);
    });
  });

  it('LA-PAT-MCP-STEPS-R01-T01 LA-PAT-MCP-STEPS-R01-T05 LA-PAT-MCP-STEPS-R01-T06 LA-PAT-MCP-STEPS-R01-T07 LA-PAT-MCP-STEPS-R01-T08 LA-PAT-MCP-STEPS-R01-T09 write a use case\'s flow as ordered steps through the MCP tools', async () => {
    await walk([
      ...LENDING,
      add('uc_requirement', { id: 'TL-LEND-UC01-R02', title: 'The due date is set', use_case_id: 'TL-LEND-UC01', statement: 'The loan MUST be due two weeks after it opens.' }),
      add('use_case', { id: 'TL-LEND-UC02', title: 'Return a tool', capability_id: 'TL-LEND-CAP01', goal: 'A member brings a tool back.' }),
      add('uc_requirement', { id: 'TL-LEND-UC02-R01', title: 'The return is dated', use_case_id: 'TL-LEND-UC02', statement: 'The return MUST carry its date.' }),
      add('view', { id: 'TL-V01', title: 'Loan desk', description: 'Where the librarian opens and closes loans.' }),
    ], async (a) => {
      // The interfaces, two offering the use case; its one flow, the same through each, and its steps in order on
      // their paths.
      await a.ok('interface_add_interface', { id: 'TL-IF01', title: 'Loan desk', product_id: 'TL', kind: 'web app', description: 'The desk where librarians lend tools.', public: false, offers: ['TL-LEND-UC01'] });
      await a.ok('interface_add_interface', { id: 'TL-IF02', title: 'Lending API', product_id: 'TL', kind: 'API', description: 'The API other systems lend tools through.', public: true, offers: ['TL-LEND-UC01'] });
      await a.ok('interface_add_interface', { id: 'TL-IF03', title: 'Librarian tools', product_id: 'TL', kind: 'agent tools', description: 'The tools an agent uses to help the librarian.', public: false });
      await a.ok('use_case_add_flow', { id: 'TL-LEND-UC01-FL', title: 'Borrow a tool', use_case_id: 'TL-LEND-UC01' });
      const step = (n: string, title: string, pathName: string, position: number, more: Record<string, unknown> = {}) =>
        a.ok('use_case_add_flow_step', { id: `TL-LEND-UC01-FL-${n}`, title, flow_id: 'TL-LEND-UC01-FL', path: pathName, position, ...more });
      await step('S01', 'The member asks for a tool at the desk', 'main', 1, { interface_id: 'TL-IF01' });
      await step('S02', 'The librarian opens the loan', 'main', 3);
      await step('S03', 'A tool on loan is refused', 'refused', 1);
      // Each step's requirements and operation; the desk's view presents the command.
      await a.ok('use_case_change_flow_step', { id: 'TL-LEND-UC01-FL-S02', invokes: 'TL-LEND-CMD01', fulfills: ['TL-LEND-UC01-R01'] });
      await a.ok('view_change_view', { id: 'TL-V01', presents: ['TL-LEND-CMD01'] });
      await a.ok('use_case_add_flow_test', { id: 'TL-LEND-UC01-FL-T', title: 'Borrow a tool end to end', flow_id: 'TL-LEND-UC01-FL', level: 'system', state: 'not automated yet', steps: ['Post a loan for a free tool'], expected_result: 'The loan is opened.' });
      // A second flow, a repeated position and a requirement of another use case are refused.
      await a.refused('use_case_add_flow', { id: 'TL-LEND-UC01-FL02', title: 'Again', use_case_id: 'TL-LEND-UC01' });
      await a.refused('use_case_add_flow_step', { id: 'TL-LEND-UC01-FL-S04', title: 'Again', flow_id: 'TL-LEND-UC01-FL', path: 'main', position: 1 });
      expect(await a.refused('use_case_change_flow_step', { id: 'TL-LEND-UC01-FL-S02', fulfills: ['TL-LEND-UC02-R01'] })).toContain('TL-LEND-UC02-R01');
      // The skipped number, the requirement the flow misses, the step the API cannot reach (no endpoint exposes its
      // command), and the interface that offers nothing, a gap in the product's coverage.
      const checked = await a.check();
      expect(found(checked, 'step-order')).toEqual([expect.stringMatching(/^TL-LEND-UC01-FL-S02: .*no step has position 2/)]);
      expect(found(checked, 'not-designed')).toContainEqual(expect.stringMatching(/^TL-LEND-UC01-R02: .*TL-LEND-UC01-FL/));
      expect(found(checked, 'step-unreached')).toEqual([expect.stringMatching(/^TL-LEND-UC01-FL-S02: .*TL-IF02/)]);
      expect(gaps(checked, 'interface-offers-nothing')).toEqual(['interface-offers-nothing TL-IF03']);
      // The Agent fixes each and checks again.
      await a.ok('use_case_move_flow_step', { id: 'TL-LEND-UC01-FL-S02', position: 2 });
      await a.ok('use_case_change_flow_step', { id: 'TL-LEND-UC01-FL-S02', fulfills: ['TL-LEND-UC01-R01', 'TL-LEND-UC01-R02'] });
      await a.ok('endpoint_add_endpoint', { id: 'TL-LEND-EP01', title: 'POST /loans', command_id: 'TL-LEND-CMD01', method: 'POST', route: '/loans', description: 'Opens a loan.' });
      await a.ok('interface_change_interface', { id: 'TL-IF03', offers: ['TL-LEND-UC02'] });
      const fixed = await a.check();
      expect(fixed.problems.filter((p) => ['step-order', 'step-unreached'].includes(p.check))).toEqual([]);
      expect(found(fixed, 'not-designed').filter((m) => m.includes('TL-LEND-UC01-FL'))).toEqual([]);
      expect(gaps(fixed, 'interface-offers-nothing')).toEqual([]);
    });
  });

  it('LA-PAT-MCP-STEPS-R01-T01 LA-PAT-MCP-STEPS-R01-T05 LA-PAT-MCP-STEPS-R01-T06 LA-PAT-MCP-STEPS-R01-T07 LA-PAT-MCP-STEPS-R01-T08 LA-PAT-MCP-STEPS-R01-T09 model each aggregate\'s entities and value objects through the MCP tools', async () => {
    await walk([
      add('domain', { id: 'TL-LEND', title: 'Lending', product_id: 'TL', position: 1, subdomain_type: 'core', description: 'Lending tools to members and getting them back.' }),
      add('aggregate', { id: 'TL-LEND-A1', title: 'Loan', domain_id: 'TL-LEND', identity: 'Loan ID', description: 'One tool lent to one member, with its return.' }),
      add('aggregate', { id: 'TL-LEND-A2', title: 'Tool', domain_id: 'TL-LEND', identity: 'Tool ID', description: 'A tool the library holds.' }),
    ], async (a) => {
      // S01: the aggregate's root and child entities.
      await a.ok('aggregate_add_entity', { id: 'TL-LEND-EN01', title: 'Loan', aggregate_id: 'TL-LEND-A1', role: 'root', description: 'The loan itself.' });
      await a.ok('aggregate_add_entity', { id: 'TL-LEND-EN02', title: 'Renewal', aggregate_id: 'TL-LEND-A1', role: 'child', in_root_table: true, description: 'The loan running longer.' });
      // S03: the value object with its constraint.
      await a.ok('value_object_add_value_object', { id: 'TL-VO01', title: 'Email address', description: 'Where a member gets mail.', fields: [{ name: 'Address', meaning: 'The address as typed.', type: 'text', required: true }] });
      await a.ok('value_object_add_constraint', { id: 'TL-VO01-C01', title: 'One at sign', value_object_id: 'TL-VO01', statement: 'An email address MUST hold exactly one @.' });
      // S02: each entity's fields, typed by a basic type, a value object or another aggregate; two types are refused.
      await a.ok('aggregate_change_entity', {
        id: 'TL-LEND-EN01',
        fields: [
          { name: 'Due date', meaning: 'The last day of the loan.', type: 'date', required: true },
          { name: 'Borrower email', meaning: 'Where reminders go.', type_value_object_id: 'TL-VO01', required: true },
          { name: 'Tool', meaning: 'The tool lent.', type_aggregate_id: 'TL-LEND-A2', required: true, column_name: 'tool_id' },
        ],
      });
      const renewedOn = { name: 'Renewed on', meaning: 'When the loan was renewed.', type: 'date', required: true };
      await a.ok('aggregate_change_entity', { id: 'TL-LEND-EN02', fields: [renewedOn] });
      await a.refused('aggregate_change_entity', { id: 'TL-LEND-EN02', fields: [renewedOn, { name: 'Fee', meaning: 'Two types.', type: 'decimal', type_value_object_id: 'TL-VO01', required: false }] });
      // S04: the child is reported until the root reaches it with has_many.
      expect(found(await a.check(), 'entity-unreferenced')).toEqual([expect.stringMatching(/^TL-LEND-EN02: /)]);
      await a.ok('aggregate_change_entity', { id: 'TL-LEND-EN01', has_many: ['TL-LEND-EN02'] });
      const checked = await a.check();
      expect(found(checked, 'entity-unreferenced')).toEqual([]);
      expect(found(checked, 'value-object-unused')).toEqual([]);
      expect(data(a.tl, 'entity_field').filter((f) => f.entity_id === 'TL-LEND-EN01').map((f) => f.name)).toEqual(['Due date', 'Borrower email', 'Tool']);
    });
  });

  it('LA-PAT-MCP-STEPS-R01-T01 LA-PAT-MCP-STEPS-R01-T05 LA-PAT-MCP-STEPS-R01-T06 LA-PAT-MCP-STEPS-R01-T07 LA-PAT-MCP-STEPS-R01-T08 LA-PAT-MCP-STEPS-R01-T09 model commands, the events they raise and the policies that hear them through the MCP tools', async () => {
    await walk([
      add('domain', { id: 'TL-LEND', title: 'Lending', product_id: 'TL', position: 1, subdomain_type: 'core', description: 'Lending tools to members and getting them back.' }),
      add('aggregate', { id: 'TL-LEND-A1', title: 'Loan', domain_id: 'TL-LEND', identity: 'Loan ID', description: 'One tool lent to one member, with its return.' }),
      add('entity', { id: 'TL-LEND-EN01', title: 'Loan', aggregate_id: 'TL-LEND-A1', role: 'root', description: 'The loan itself.' }),
      add('aggregate', { id: 'TL-LEND-A2', title: 'Tool', domain_id: 'TL-LEND', identity: 'Tool ID', description: 'A tool the library holds.' }),
      add('specification', { id: 'TL-LEND-SP01', title: 'Tool is free', statement: 'A tool is free when no active loan names it.' }),
      link('TL-LEND-SP01', 'reads', 'TL-LEND-A1'),
      add('domain_event', { id: 'TL-LEND-EV02', title: 'Tool lent', aggregate_id: 'TL-LEND-A2', published: false, description: 'A tool left the shelf.' }),
    ], async (a) => {
      // S01: the commands, and the event with its field.
      await a.ok('command_add_command', { id: 'TL-LEND-CMD01', title: 'Open a loan', entity_id: 'TL-LEND-EN01', description: 'Lends a free tool to a member.' });
      await a.ok('command_add_command', { id: 'TL-LEND-CMD02', title: 'Open a reminder', entity_id: 'TL-LEND-EN01', description: 'Sets a reminder for the loan\'s due date.' });
      await a.ok('domain_event_add_domain_event', {
        id: 'TL-LEND-EV01',
        title: 'Loan opened',
        aggregate_id: 'TL-LEND-A1',
        published: false,
        description: 'A tool went out on loan.',
        fields: [{ name: 'Loan ID', meaning: 'Which loan.', type_aggregate_id: 'TL-LEND-A1', required: true }],
      });
      // S02: what the command raises and checks; the event other domains hear is published.
      await a.ok('command_change_command', { id: 'TL-LEND-CMD01', raises: ['TL-LEND-EV01'], checks: ['TL-LEND-SP01'] });
      await a.ok('domain_event_change_domain_event', { id: 'TL-LEND-EV01', published: true });
      expect(await a.refused('command_change_command', { id: 'TL-LEND-CMD01', raises: ['TL-LEND-EV01', 'TL-LEND-EV02'] })).toContain('TL-LEND-EV02');
      // S03: a policy under the command it invokes, hearing one event.
      await a.ok('command_add_policy', { id: 'TL-LEND-PO01', title: 'Remind on loan', command_id: 'TL-LEND-CMD02', statement: 'Whenever a loan is opened, the library MUST open its reminder.', hears: 'TL-LEND-EV01' });
      const shown = await a.ok('command_get_command', { id: 'TL-LEND-CMD01' });
      for (const id of ['TL-LEND-SP01', 'TL-LEND-EV01']) expect(shown).toContain(id);
      expect(data(a.tl, 'hears')).toEqual([{ source_id: 'TL-LEND-PO01', target_id: 'TL-LEND-EV01' }]);
    });
  });

  it('LA-PAT-MCP-STEPS-R01-T01 LA-PAT-MCP-STEPS-R01-T05 LA-PAT-MCP-STEPS-R01-T06 LA-PAT-MCP-STEPS-R01-T07 LA-PAT-MCP-STEPS-R01-T08 LA-PAT-MCP-STEPS-R01-T09 write the test plan, one test kind per thing tested, through the MCP tools', async () => {
    await walk([
      ...LENDING,
      add('invariant', { id: 'TL-LEND-INV01', title: 'One active loan per tool', aggregate_id: 'TL-LEND-A1', statement: 'A tool MUST NOT have two active loans.' }),
      add('uc_requirement', { id: 'TL-LEND-UC01-R02', title: 'A member in debt is refused', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse a member who owes a fee.' }),
    ], async (a) => {
      a.tl.write('test/loans.test.ts', "it('TL-LEND-INV01-T one active loan per tool');\nit('TL-LEND-UC01-R01-T01 a tool on loan is refused');\n");
      // S01: each test under the record it tests, of the kind named after it, with its run by.
      await a.ok('aggregate_add_invariant_test', { id: 'TL-LEND-INV01-T', title: 'One active loan per tool', invariant_id: 'TL-LEND-INV01', level: 'integration', state: 'automated', file: 'test/loans.test.ts', when: 'A second loan opens for a tool on an active loan', then: 'It is refused' });
      await a.ok('use_case_add_use_case_test', { id: 'TL-LEND-UC01-R01-T01', title: 'A tool on loan is refused', uc_requirement_id: 'TL-LEND-UC01-R01', level: 'service', state: 'automated', file: 'test/loans.test.ts', when: 'A member borrows a tool that is on loan', then: 'The loan is refused' });
      await a.refused('use_case_add_use_case_test', { id: 'TL-LEND-INV01-T01', title: 'Under the wrong kind', uc_requirement_id: 'TL-LEND-INV01', level: 'service', state: 'not automated yet', when: 'A second loan opens', then: 'It is refused' });
      // S02: the requirements sorted into a group.
      await a.ok('use_case_change_uc_requirement', { id: 'TL-LEND-UC01-R01', group_name: 'Refusals' });
      await a.ok('use_case_change_uc_requirement', { id: 'TL-LEND-UC01-R02', group_name: 'Refusals' });
      expect(data(a.tl, 'uc_requirement').map((r) => r.group_name)).toEqual(['Refusals', 'Refusals']);
      // S03: the data set the tests start from, reported until a test starts from it and its file exists.
      await a.ok('test_data_set_add_test_data_set', { id: 'TL-LEND-TD01', title: 'One tool on loan', domain_id: 'TL-LEND', environment: 'The test database.', records: 'One member, one tool on loan.', prepare: 'Run the seed.', reset: 'Drop the database.', file: 'test/seed.ts', description: 'A tool already lent, for the tests that refuse a second loan.' });
      expect(found(await a.check(), 'test-data-set-unused')).toEqual([expect.stringMatching(/^TL-LEND-TD01: /)]);
      await a.ok('aggregate_change_invariant_test', { id: 'TL-LEND-INV01-T', starts_from: ['TL-LEND-TD01'] });
      const linked = await a.check();
      expect(found(linked, 'test-data-set-unused')).toEqual([]);
      expect(linked.problems.filter((p) => p.check === 'test-data-set-file-missing').map((p) => [p.severity, p.record])).toEqual([['error', 'TL-LEND-TD01']]);
      a.tl.write('test/seed.ts', '// One member, one tool on loan.\n');
      expect(found(await a.check(), 'test-data-set-file-missing')).toEqual([]);
    });
  });

  it('LA-PAT-MCP-STEPS-R01-T01 LA-PAT-MCP-STEPS-R01-T05 LA-PAT-MCP-STEPS-R01-T06 LA-PAT-MCP-STEPS-R01-T07 LA-PAT-MCP-STEPS-R01-T08 LA-PAT-MCP-STEPS-R01-T09 write the engineering standards the code follows through the MCP tools', async () => {
    await walk([...LENDING, add('command_handler', { id: 'TL-LEND-CMD01-H', title: 'openLoan', command_id: 'TL-LEND-CMD01', file: 'src/loans.ts', description: 'Opens the loan in one transaction.' })], async (a) => {
      a.tl.write('src/loans.ts', '// TL-LEND-CMD01-H\n');
      a.tl.write('test/standards.test.ts', "it('TL-STD-LOG-R01-T01 no console.log in src');\n");
      // S01: a standard and its rule.
      await a.ok('standard_add_standard', { id: 'TL-STD-LOG', title: 'Logging', product_id: 'TL', type: 'engineering', description: 'How the code logs what it does.' });
      await a.ok('standard_add_standard_rule', { id: 'TL-STD-LOG-R01', title: 'No console.log', standard_id: 'TL-STD-LOG', statement: 'Code MUST log through the logger, never console.log.' });
      // S02: the technical record that meets it, and the test that proves it.
      await a.ok('command_change_command_handler', { id: 'TL-LEND-CMD01-H', meets: ['TL-STD-LOG-R01'] });
      await a.ok('standard_add_standard_rule_test', { id: 'TL-STD-LOG-R01-T01', title: 'No console.log in src', standard_rule_id: 'TL-STD-LOG-R01', level: 'unit', state: 'automated', file: 'test/standards.test.ts', when: 'The test reads every file under src', then: 'No file calls console.log' });
      // S03: the standard with its rule, what meets it and its test.
      const shown = await a.ok('standard_get_standard', { id: 'TL-STD-LOG' });
      for (const id of ['TL-STD-LOG-R01', 'TL-LEND-CMD01-H', 'TL-STD-LOG-R01-T01']) expect(shown).toContain(id);
    });
  });

  it('LA-PAT-MCP-STEPS-R01-T01 LA-PAT-MCP-STEPS-R01-T05 LA-PAT-MCP-STEPS-R01-T06 LA-PAT-MCP-STEPS-R01-T07 LA-PAT-MCP-STEPS-R01-T08 LA-PAT-MCP-STEPS-R01-T09 write the technical records that build the design through the MCP tools', async () => {
    await walk([
      ...LENDING,
      add('invariant', { id: 'TL-LEND-INV01', title: 'One active loan per tool', aggregate_id: 'TL-LEND-A1', statement: 'A tool MUST NOT have two active loans.' }),
      add('entity_field', { entity_id: 'TL-LEND-EN01', position: 2, name: 'Tool ID', meaning: 'The tool lent.', type: 'text', required: true }),
    ], async (a) => {
      // S01: the technical records under the design records they implement, naming their file.
      await a.ok('command_add_command_handler', { id: 'TL-LEND-CMD01-H', title: 'openLoan', command_id: 'TL-LEND-CMD01', file: 'src/loans.ts', description: 'Opens the loan in one transaction.' });
      await a.ok('domain_add_repository', { id: 'TL-LEND-REPO01', title: 'Loans', domain_id: 'TL-LEND', file: 'src/loans.ts', description: 'Keeps loans in one table and reads them by tool.', persists: 'TL-LEND-A1' });
      expect(found(await a.check(), 'technical-file-missing').sort()).toEqual([expect.stringMatching(/^TL-LEND-CMD01-H: /), expect.stringMatching(/^TL-LEND-REPO01: /)]);
      a.tl.write('src/loans.ts', '// TL-LEND-CMD01-H TL-LEND-REPO01\n');
      // S02: the entity's table with its keys, the unique key naming the invariant it enforces.
      const keys = [
        { type: 'primary', columns: ['id'] },
        { type: 'unique', columns: ['tool_id'], invariant_id: 'TL-LEND-INV01', condition: 'returned_at IS NULL' },
      ];
      await a.ok('table_add_table', { id: 'TL-LEND-EN01-TB', title: 'Loans', entity_id: 'TL-LEND-EN01', name: 'loan', storage: 'table', file: 'src/loans.ts', keys });
      await a.refused('table_change_table', { id: 'TL-LEND-EN01-TB', keys: [...keys, { type: 'index', columns: ['tool_id'], invariant_id: 'TL-LEND-INV01' }] });
      expect(found(await a.check(), 'technical-file-missing')).toEqual([]);
      expect(data(a.tl, 'table_key').map((k) => [k.type, k.invariant_id ?? null])).toEqual([['primary', null], ['unique', 'TL-LEND-INV01']]);
    });
  });

  it('LA-PAT-MCP-STEPS-R01-T01 LA-PAT-MCP-STEPS-R01-T05 LA-PAT-MCP-STEPS-R01-T06 LA-PAT-MCP-STEPS-R01-T07 LA-PAT-MCP-STEPS-R01-T08 LA-PAT-MCP-STEPS-R01-T09 write the views, endpoints and integrations a flow reaches through the MCP tools', async () => {
    await walk([
      ...LENDING,
      add('interface', { id: 'TL-IF01', title: 'Loan desk', product_id: 'TL', kind: 'web app', description: 'The desk where librarians lend tools.', public: false }),
      add('flow', { id: 'TL-LEND-UC01-FL', title: 'Borrow a tool', use_case_id: 'TL-LEND-UC01' }),
      add('flow_step', { id: 'TL-LEND-UC01-FL-S01', title: 'The member borrows a tool', flow_id: 'TL-LEND-UC01-FL', path: 'main', position: 1 }),
    ], async (a) => {
      // S01: an endpoint under the command it exposes.
      await a.ok('endpoint_add_endpoint', { id: 'TL-LEND-EP01', title: 'POST /loans', command_id: 'TL-LEND-CMD01', method: 'POST', route: '/loans', description: 'Opens a loan from the desk.' });
      // S02: view requirements under views and API requirements under endpoints.
      await a.ok('view_add_view', { id: 'TL-V01', title: 'Loan desk', route: '/loans', description: 'Where the librarian opens and closes loans.' });
      await a.ok('view_add_view_requirement', { id: 'TL-V01-R01', title: 'The due date shows', view_id: 'TL-V01', statement: 'The desk MUST show the loan\'s due date.' });
      await a.ok('endpoint_add_api_requirement', { id: 'TL-LEND-EP01-R01', title: 'A tool on loan is refused', endpoint_id: 'TL-LEND-EP01', statement: 'The endpoint MUST answer 409 for a tool on loan.' });
      await a.ok('integration_add_integration', { id: 'TL-INT01', title: 'Mail', system: 'The mail service', description: 'Sends the library\'s mail to members.' });
      // The check reports the view that presents nothing and the integration no step exchanges with, until they are linked.
      const unused = await a.check();
      expect([...found(unused, 'view-unused'), ...found(unused, 'integration-unused')]).toEqual([expect.stringMatching(/^TL-V01: /), expect.stringMatching(/^TL-INT01: /)]);
      await a.ok('view_change_view', { id: 'TL-V01', presents: ['TL-LEND-CMD01'] });
      await a.ok('use_case_change_flow_step', { id: 'TL-LEND-UC01-FL-S01', exchanges_with: ['TL-INT01'], invokes: 'TL-LEND-CMD01' });
      expect((await a.check()).problems.filter((p) => p.severity === 'error')).toEqual([]);
    });
  });

  it('LA-PAT-MCP-STEPS-R01-T01 LA-PAT-MCP-STEPS-R01-T05 LA-PAT-MCP-STEPS-R01-T06 LA-PAT-MCP-STEPS-R01-T07 LA-PAT-MCP-STEPS-R01-T08 LA-PAT-MCP-STEPS-R01-T09 sort a domain\'s rules by what they do through the MCP tools', async () => {
    await walk([
      ...LENDING,
      add('read_model', { id: 'TL-LEND-RM01', title: 'Free tools', domain_id: 'TL-LEND', description: 'The tools on no active loan.' }),
      add('query', { id: 'TL-LEND-QRY01', title: 'List free tools', read_model_id: 'TL-LEND-RM01', description: 'The free tools, by name.' }),
      add('value_object', { id: 'TL-VO01', title: 'Email address', description: 'Where a member gets mail.' }),
      add('value_object_field', { value_object_id: 'TL-VO01', position: 1, name: 'Address', meaning: 'The address as typed.', type: 'text', required: true }),
      add('entity_field', { entity_id: 'TL-LEND-EN01', position: 2, name: 'Borrower email', meaning: 'Where reminders go.', type_value_object_id: 'TL-VO01', required: true }),
      add('table', { id: 'TL-LEND-EN01-TB', title: 'Loans', entity_id: 'TL-LEND-EN01', name: 'loan', storage: 'table' }),
    ], async (a) => {
      // S01: the value format as a constraint of its value object.
      await a.ok('value_object_add_constraint', { id: 'TL-VO01-C01', title: 'One at sign', value_object_id: 'TL-VO01', statement: 'An email address MUST hold exactly one @.' });
      // S02: the rule of one aggregate as its invariant, named on the unique key that enforces it.
      await a.ok('aggregate_add_invariant', { id: 'TL-LEND-INV01', title: 'One loan per number', aggregate_id: 'TL-LEND-A1', statement: 'No two loans MUST share a number.' });
      await a.ok('table_change_table', { id: 'TL-LEND-EN01-TB', keys: [{ type: 'unique', columns: ['id'], invariant_id: 'TL-LEND-INV01' }] });
      // S03: the check across aggregates as a specification, reported until linked.
      await a.ok('specification_add_specification', { id: 'TL-LEND-SP01', title: 'Tool is free', statement: 'A tool is free when no active loan names it.' });
      expect(found(await a.check(), 'specification-unused')).toEqual([expect.stringMatching(/^TL-LEND-SP01: /)]);
      await a.ok('specification_change_specification', { id: 'TL-LEND-SP01', reads: ['TL-LEND-A1'] });
      await a.ok('command_change_command', { id: 'TL-LEND-CMD01', checks: ['TL-LEND-SP01'] });
      await a.ok('read_model_change_query', { id: 'TL-LEND-QRY01', selects_by: ['TL-LEND-SP01'] });
      expect(found(await a.check(), 'specification-unused')).toEqual([]);
    });
  });

  it('LA-PAT-MCP-STEPS-R01-T01 LA-PAT-MCP-STEPS-R01-T05 LA-PAT-MCP-STEPS-R01-T06 LA-PAT-MCP-STEPS-R01-T07 LA-PAT-MCP-STEPS-R01-T08 LA-PAT-MCP-STEPS-R01-T09 model read models, queries, domain services and terms through the MCP tools', async () => {
    await walk(LENDING, async (a) => {
      // S01: the read model with its fields, the aggregate it reads, and its query; another domain's query is refused.
      await a.ok('read_model_add_read_model', { id: 'TL-LEND-RM01', title: 'Loans by member', domain_id: 'TL-LEND', description: 'Each member\'s open loans.', fields: [{ name: 'Loan', meaning: 'Which loan.', type_aggregate_id: 'TL-LEND-A1', required: true }], reads: ['TL-LEND-A1'] });
      await a.ok('read_model_add_query', { id: 'TL-LEND-QRY01', title: 'List a member\'s loans', read_model_id: 'TL-LEND-RM01', description: 'One member\'s loans, the latest first.' });
      await a.refused('read_model_add_query', { id: 'TL-SHOP-QRY01', title: 'Another domain\'s query', read_model_id: 'TL-LEND-RM01', description: 'A query filed under the wrong domain.' });
      // S02: a domain service the query calls, and a term.
      await a.ok('domain_add_domain_service', { id: 'TL-LEND-DS01', title: 'Late fee', domain_id: 'TL-LEND', statement: 'The fee MUST be a day rate times the days late.' });
      await a.ok('read_model_change_query', { id: 'TL-LEND-QRY01', calls: ['TL-LEND-DS01'] });
      await a.ok('domain_add_term', { id: 'TL-LEND-TM01', title: 'Loan', domain_id: 'TL-LEND', meaning: 'One tool lent to one member until it is returned.' });
      const shown = await a.ok('domain_get_domain', { id: 'TL-LEND' });
      for (const id of ['TL-LEND-DS01', 'TL-LEND-TM01']) expect(shown).toContain(id);
      expect(await a.ok('read_model_get_read_model', { id: 'TL-LEND-RM01' })).toContain('TL-LEND-QRY01');
      expect((await a.check()).errors).toBe(0);
    });
  });

  it('LA-PAT-MCP-STEPS-R01-T01 LA-PAT-MCP-STEPS-R01-T05 LA-PAT-MCP-STEPS-R01-T06 LA-PAT-MCP-STEPS-R01-T07 LA-PAT-MCP-STEPS-R01-T08 LA-PAT-MCP-STEPS-R01-T09 write the business outcomes the product exists to achieve through the MCP tools', async () => {
    await walk(LENDING, async (a) => {
      // S01: a measurable outcome under the product; one without its measure is refused.
      expect(await a.ok('business_outcome_next_id', { product_id: 'TL' })).toBe('TL-BO01');
      await a.refused('business_outcome_add_business_outcome', { id: 'TL-BO01', title: 'More tools in use', product_id: 'TL', statement: 'Members borrow more tools.', target: 'Twice as many.' });
      await a.ok('business_outcome_add_business_outcome', { id: 'TL-BO01', title: 'More tools in use', product_id: 'TL', statement: 'Members borrow the library\'s tools more often.', measure: 'Loans opened per tool per month.', target: 'Two per tool per month within a year.' });
      // S02: the capability that serves it.
      await a.ok('domain_change_capability', { id: 'TL-LEND-CAP01', serves: ['TL-BO01'] });
      // S03: the test that measures it.
      await a.ok('use_case_add_use_case_test', { id: 'TL-LEND-UC01-R01-T01', title: 'Loans are counted per tool', uc_requirement_id: 'TL-LEND-UC01-R01', level: 'service', state: 'not automated yet', when: 'Members borrow tools for a month', then: 'The loans are counted per tool' });
      await a.ok('business_outcome_change_business_outcome', { id: 'TL-BO01', measured_by: ['TL-LEND-UC01-R01-T01'] });
      const shown = await a.ok('business_outcome_get_business_outcome', { id: 'TL-BO01' });
      expect(shown).toContain('TL-LEND-CAP01');
      expect(shown).toContain('TL-LEND-UC01-R01-T01');
    });
  });
});

describe('Checking flows through the MCP tools', () => {
  it('LA-PAT-MCP-STEPS-R01-T02 add a check through the MCP tools', async () => {
    await walk([...LENDING, add('aggregate', { id: 'TL-LEND-A2', title: 'Tool', domain_id: 'TL-LEND', identity: 'Tool ID', description: 'A tool the library holds.' })], async (a) => {
      // S01: the check as one row, with the Check aggregate's own command.
      expect(await a.ok('check_add_check', NO_COMMAND)).toContain('Added check aggregate-without-command');
      expect(a.tl.read('data/check.jsonl')).toContain('"name":"aggregate-without-command"');
      // S02: the check tool runs it among the others.
      expect(found(await a.check(), 'aggregate-without-command')).toEqual(['TL-LEND-A2: Aggregate TL-LEND-A2 has no command.']);
    });
  });

  it('LA-PAT-MCP-STEPS-R01-T02 find structural problems through the MCP tools', async () => {
    // Stages written at different times: a view nothing uses yet, a use case with no flow, a test at a level its kind
    // does not allow, and a policy hearing an event of a stored aggregate that is delivered in process.
    await walk([
      ...LENDING,
      add('table', { id: 'TL-LEND-EN01-TB', title: 'Loans', entity_id: 'TL-LEND-EN01', name: 'loan', storage: 'table' }),
      add('aggregate', { id: 'TL-LEND-A2', title: 'Tool', domain_id: 'TL-LEND', identity: 'Tool ID', description: 'A tool the library holds.' }),
      add('command', { id: 'TL-LEND-CMD02', title: 'Open a reminder', entity_id: 'TL-LEND-EN01', description: 'Sets a reminder for the loan\'s due date.' }),
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
      // S04: the shape warnings, and the use case with no flow a gap in its domain's coverage, never a problem.
      expect(found(checked, 'test-level-not-allowed')).toEqual([expect.stringMatching(/^TL-LEND-UC01-R01-T01: /)]);
      expect(found(checked, 'event-not-by-outbox')).toEqual([expect.stringMatching(/^TL-LEND-EV01: /)]);
      expect(checked.products[0].coverage.find((c) => c.domain === 'TL-LEND')!.gaps).toContainEqual(expect.objectContaining({ id: 'TL-LEND-UC01', missing: 'use-case-without-flow' }));
      expect(found(checked, 'use-case-without-flow')).toEqual([]);
      // S05: the Agent fixes the error and the warnings, and calls the check tool again.
      await a.ok('view_remove_view', { id: 'TL-V01' });
      await a.ok('use_case_change_use_case_test', { id: 'TL-LEND-UC01-R01-T01', level: 'service' });
      await a.ok('domain_event_change_event_type', { id: 'TL-LEND-EV01-ET', delivery: 'outbox' });
      expect((await a.check()).problems.filter((p) => ['view-unused', 'test-level-not-allowed', 'event-not-by-outbox'].includes(p.check))).toEqual([]);
      // S02: a test given its parent's ID is refused once, naming its rule, file and line, and nothing that follows from it.
      appendFileSync(path.join(a.tl.root, 'data', 'use_case_test.jsonl'), '{"id":"TL-LEND-UC01-R01","title":"Given its parent\'s ID","uc_requirement_id":"TL-LEND-UC01-R01","level":"service","state":"not automated yet","when":"A member borrows a tool that is on loan","then":"The loan is refused"}\n');
      const refused = await a.check();
      expect(refused.problems).toHaveLength(1);
      expect(refused.problems[0]).toMatchObject({ severity: 'error', check: 'data-refused' });
      expect(refused.problems[0].message).toMatch(/^data\/use_case_test\.jsonl:2: .*\[[a-z-]+\]$/);
    });
  });

  it('LA-PAT-MCP-STEPS-R01-T02 add a product\'s own checks through the MCP tools', async () => {
    await walk([...LENDING, add('aggregate', { id: 'TL-LEND-A2', title: 'Tool', domain_id: 'TL-LEND', identity: 'Tool ID', description: 'A tool the library holds.' })], async (a) => {
      // S02: a house rule as a check row with the product's product_id.
      await a.ok('check_add_check', NO_COMMAND);
      expect(a.tl.read('data/check.jsonl')).toContain('"product_id":"TL"');
      // S03: Lathe's checks run first, then the product's, its problems carrying its row's name.
      const checked = await a.check();
      const names = checked.problems.map((p) => p.check);
      expect(found(checked, 'aggregate-without-command')).toEqual(['TL-LEND-A2: Aggregate TL-LEND-A2 has no command.']);
      expect(names.lastIndexOf('aggregate-without-command')).toBe(names.length - 1);
      // S04: the Agent fixes what it finds and checks again.
      await a.ok('aggregate_add_entity', { id: 'TL-LEND-EN09', title: 'Tool', aggregate_id: 'TL-LEND-A2', role: 'root', description: 'A tool on the shelf or out.' });
      await a.ok('command_add_command', { id: 'TL-LEND-CMD02', title: 'Add a tool', entity_id: 'TL-LEND-EN09', description: 'Puts a named tool in the catalog.' });
      expect(found(await a.check(), 'aggregate-without-command')).toEqual([]);
      // S05: a check named like one of Lathe's is refused, naming lathe/data/check.jsonl.
      expect(await a.refused('check_add_check', { ...NO_COMMAND, name: 'view-unused' })).toContain('lathe/data/check.jsonl');
      // S06: a product check whose query fails is an error naming it, and the other checks still run.
      await a.ok('check_add_check', { ...NO_COMMAND, name: 'broken-house-rule', position: 2, query: 'SELECT id AS record, title AS message FROM no_such_table' });
      await a.ok('view_add_view', { id: 'TL-V01', title: 'Loan page', description: 'Shows one loan and its due date.' });
      const failing = await a.check();
      expect(failing.problems.filter((p) => p.message.includes('broken-house-rule')).map((p) => p.severity)).toEqual(['error']);
      expect(found(failing, 'view-unused')).toHaveLength(1);
      // S07: a checks key in lathe.config.json is refused as an unknown setting.
      a.tl.write('lathe.config.json', '{ "checks": [] }\n');
      const config = await a.server.call('check', {});
      expect(JSON.stringify(config)).toContain('unknown setting \\"checks\\"');
    });
  });

  it('LA-PAT-MCP-STEPS-R01-T02 keep each level of the spec a useful size through the MCP tools', async () => {
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
      await a.ok('product_setting_set_limits', { product_id: 'TL', max_children: 2, max_entities_per_aggregate: 2 });
      // S02, S03: too many children, too many entities, and a capability and a group with one child.
      const checked = await a.check();
      expect(found(checked, 'too-many-children').sort()).toEqual([expect.stringMatching(/^TL-LEND-A1: .*3 children of kind entity/), expect.stringMatching(/^TL-LEND-UC01: .*3 /)]);
      expect(found(checked, 'aggregate-too-large')).toEqual([expect.stringMatching(/^TL-LEND-A1: /)]);
      expect(found(checked, 'lone-child').sort()).toEqual([expect.stringMatching(/^TL-LEND-CAP01: /), expect.stringMatching(/^TL-LEND-UC01: .*"Dates"/)]);
      // S04: the Agent raises the limits, adds a use case, clears the group and checks again.
      await a.ok('product_setting_set_limits', { product_id: 'TL', max_children: 15, max_entities_per_aggregate: 7 });
      await a.ok('use_case_add_use_case', { id: 'TL-LEND-UC02', title: 'Return a tool', capability_id: 'TL-LEND-CAP01', goal: 'A member brings a tool back.' });
      await a.ok('use_case_change_uc_requirement', { id: 'TL-LEND-UC01-R04', group_name: null });
      expect((await a.check()).problems.filter((p) => ['too-many-children', 'aggregate-too-large', 'lone-child'].includes(p.check))).toEqual([]);
    });
  });
});
