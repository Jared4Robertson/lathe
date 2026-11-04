// Coverage: every obligation designed, built and proved, per domain and for what the product shares, and the
// records short of a minimum. Each case starts from the complete product, where everything is covered.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CHANGE_SETTING_VALUES } from '../src/traceability/pattern-following/commands/change-setting-values.ts';
import { ALLOWED_LEVELS, GAP_RULES, openStore, StoreError, type Workspace } from '../src/index.ts';
import { runCommand } from '../src/platform/commands/run.ts';
import { adding, build, changing, complete, gaps, loadData, obligation, ofCheck, records, removeData, sparse, SPARSE_FILES, withJourney, without, type Data } from './helpers.ts';

afterAll(removeData);

const covered = (total: number) => ({ total, designed: total, built: total, proved: total, not_automated: 0 });

let clean: Workspace;
beforeAll(async () => {
  clean = await loadData(complete());
});

describe('coverage of the complete product', () => {
  it('LA-TRC-UC02-R01-T01 counts every obligation kind, in kind order, per domain and for what the product shares', () => {
    expect(clean.coverage.map((c) => [c.product, c.domain])).toEqual([['EX', 'EX-LEND'], ['EX', null]]);
    const lending = clean.coverage[0];
    expect(lending.obligations.map((o) => o.kind)).toEqual(['constraint', 'invariant', 'specification', 'policy', 'domain_service', 'storage_requirement', 'uc_requirement', 'pattern_rule', 'view_requirement', 'api_requirement', 'standard_rule']);
    expect(obligation(clean, 'EX-LEND', 'uc_requirement')).toMatchObject({ label: 'UC requirement', proof_only: false, ...covered(2) });
    expect(obligation(clean, 'EX-LEND', 'pattern_rule')).toMatchObject({ proof_only: true, ...covered(1) });
    for (const kind of ['invariant', 'specification', 'policy', 'domain_service', 'api_requirement']) expect(obligation(clean, 'EX-LEND', kind), kind).toMatchObject(covered(1));
    // A constraint and a view requirement follow their value object and view into the one domain that uses them; a
    // standard rule is shared, under its standard.
    for (const kind of ['constraint', 'view_requirement']) {
      expect(obligation(clean, 'EX-LEND', kind), kind).toMatchObject(covered(1));
      expect(obligation(clean, null, kind), kind).toMatchObject({ total: 0 });
    }
    expect(obligation(clean, null, 'standard_rule')).toMatchObject(covered(1));
    expect(obligation(clean, 'EX-LEND', 'standard_rule')).toMatchObject({ total: 0 });
    expect(gaps(clean)).toEqual([]);
  });

  it("LA-TRC-UC02-R08-T01 A constraint counts in its value object's domain, or in Shared when two domains use it", async () => {
    expect(obligation(clean, 'EX-LEND', 'constraint')).toMatchObject(covered(1));
    // A second domain's entity has a field typed by the value object: the product shares it, with its constraint.
    const shared = await loadData(
      adding(complete(), {
        domain: [{ id: 'EX-SHOP', title: 'Shop', product_id: 'EX', position: 2, subdomain_type: 'supporting', description: 'Selling spare parts.' }],
        aggregate: [{ id: 'EX-SHOP-A1', title: 'Order', domain_id: 'EX-SHOP', identity: 'Order ID', description: 'One order of parts.' }],
        entity: [{ id: 'EX-SHOP-EN01', title: 'Order', aggregate_id: 'EX-SHOP-A1', role: 'root', description: 'The order itself.' }],
        entity_field: [{ entity_id: 'EX-SHOP-EN01', position: 1, name: 'Buyer email', meaning: 'Where the receipt goes.', type_value_object_id: 'EX-VO01', required: true }],
      }),
    );
    expect(obligation(shared, null, 'constraint')).toMatchObject(covered(1));
    expect(obligation(shared, 'EX-LEND', 'constraint')).toMatchObject({ total: 0 });
    expect(obligation(shared, 'EX-SHOP', 'constraint')).toMatchObject({ total: 0 });
  });

  it('LA-TRC-UC06-R02-T01 counts the tests of each scope by state', () => {
    expect(clean.coverage[0].tests).toEqual({ automated: 12, manual: 2, not_automated: 0 });
    // Outside every domain: the standard rule's test.
    expect(clean.coverage[1].tests).toEqual({ automated: 1, manual: 0, not_automated: 0 });
  });
});

describe('designed and built', () => {
  let ws: Workspace;
  beforeAll(async () => {
    let data = without(complete(), 'value_type', () => true);
    data = without(data, 'predicate', () => true);
    data = without(data, 'event_handler', () => true);
    data = without(data, 'builds', () => true);
    data = without(data, 'endpoint_handler', () => true);
    data = without(data, 'provided_by', (r) => r.source_id === 'EX-LEND-EP01-R01');
    data = without(data, 'meets', (r) => r.source_id === 'EX-LEND-CMD01-H');
    data = without(data, 'fulfills', (r) => r.source_id === 'EX-LEND-UC02-FL-S01');
    ws = await loadData(data, { missing: ['src/dates.ts'] });
  });

  it('LA-TRC-UC01-R01-T01 a UC requirement is designed once a step fulfills it, a standard rule once a technical record meets it; the rest by construction', () => {
    expect(gaps(ws).filter((g) => g.startsWith('designed'))).toEqual([
      'designed EX-LEND-UC02-R01', // no step fulfills it
      'designed EX-STD-CODE-R01', // no technical record meets it
    ]);
    expect(obligation(ws, 'EX-LEND', 'constraint')).toMatchObject({ total: 1, designed: 1, built: 0, proved: 1 });
  });

  it('LA-TRC-UC01-R04-T01 an obligation is built once the technical record that implements it names a file that exists, counted apart from designed and proved', () => {
    expect(gaps(ws).filter((g) => g.startsWith('built'))).toEqual([
      'built EX-LEND-DS01', // its service's file is missing
      'built EX-LEND-EP01-R01', // its endpoint has no handler
      'built EX-LEND-PO01', // no event handler
      'built EX-LEND-SP01', // no predicate
      'built EX-LEND-UC01-R01', // its command checks that specification and calls that service
      'built EX-V01-R01', // no UI component builds it
      'built EX-VO01-C01', // its value object has no value type
    ]);
    expect(obligation(ws, 'EX-LEND', 'domain_service')).toMatchObject({ total: 1, designed: 1, built: 0, proved: 1 });
    // An obligation not designed is not reported as not built as well.
    expect(gaps(ws)).not.toContain('built EX-LEND-UC02-R01');
  });

  it('LA-TRC-UC01-R04-T02 an invariant is built only by its rule, once the rule\'s file exists: no data model or unique key builds it', async () => {
    const noRule = without(complete(), 'rule', () => true);
    // The aggregate's data models name files that exist, and the loans table gets a unique key naming the invariant.
    const key = { table_key: [{ table_id: 'EX-LEND-EN01-TB', position: 2, type: 'unique', columns: ['tool_id'], invariant_id: 'EX-LEND-INV01' }] };
    expect(gaps(await loadData(adding(noRule, key)))).toEqual(['built EX-LEND-INV01']);
    expect(obligation(clean, 'EX-LEND', 'invariant')).toMatchObject({ designed: 1, built: 1 });
    expect(obligation(await loadData(complete(), { missing: ['src/loans.ts'] }), 'EX-LEND', 'invariant')).toMatchObject({ designed: 1, built: 0 });
  });

  it('LA-TRC-UC02-R02-T02 an obligation is built only when every record that implements it names a file that exists, a UC requirement through what its commands check and call', async () => {
    // UC01-R01 is carried out by two handlers; the query handler's file is missing, though the command handler's exists.
    expect(gaps(await loadData(complete(), { missing: ['src/tools.ts'] }))).toContain('built EX-LEND-UC01-R01');
    // The command its first step invokes checks SP01 and calls DS01: with no predicate, or the service's file missing,
    // the requirement is not built, though both handlers' files exist.
    expect(gaps(await loadData(without(complete(), 'predicate', () => true)))).toEqual(['built EX-LEND-SP01', 'built EX-LEND-UC01-R01']);
    expect(gaps(await loadData(complete(), { missing: ['src/dates.ts'] }))).toEqual(['built EX-LEND-DS01', 'built EX-LEND-UC01-R01']);
    // An invariant is built by its rule alone: a data model of its aggregate with no file yet does not count against it.
    const apart = changing(complete(), 'data_model', (r) => r.id === 'EX-LEND-EN02-DM', { file: 'src/returns.ts' });
    expect(gaps(await loadData(apart, { missing: ['src/returns.ts' ] }))).toEqual([]);
    // A view requirement two UI components build is built only while both files exist.
    const twice = adding(complete(), {
      ui_component: [{ id: 'EX-UI02', title: 'FreeFirst', file: 'web/free-first.tsx', description: 'Sorts the free tools first.' }],
      renders: [{ source_id: 'EX-UI02', target_id: 'EX-V01' }],
      builds: [{ source_id: 'EX-UI02', target_id: 'EX-V01-R01' }],
    });
    expect(gaps(await loadData(twice))).toEqual([]);
    expect(gaps(await loadData(twice, { missing: ['web/free-first.tsx'] }))).toEqual(['built EX-V01-R01']);
  });

  it("LA-TRC-UC01-R04-T03 a UC requirement is built only through the handler of what its steps invoke: a UI component of the view a step happens in builds nothing", async () => {
    // UC01-R01 is fulfilled by S01 alone now, which invokes nothing; it still happens in the catalog, which a UI component renders.
    const alone = without(complete(), 'fulfills', (r) => r.source_id === 'EX-LEND-UC01-FL-S02');
    const viaView = await loadData(without(alone, 'invokes', (r) => r.source_id === 'EX-LEND-UC01-FL-S01'));
    expect(gaps(viaView).filter((g) => !g.startsWith('record-untraced'))).toEqual(['built EX-LEND-UC01-R01']);
    expect(viaView.coverage[0].gaps.find((g) => g.missing === 'built')).toEqual({ id: 'EX-LEND-UC01-R01', kind: 'uc_requirement', missing: 'built', message: 'UC requirement EX-LEND-UC01-R01 is not built yet: not every file of what implements it exists.' });
    expect(obligation(await loadData(alone), 'EX-LEND', 'uc_requirement')).toMatchObject(covered(2));
  });

  it('LA-TRC-UC02-R06-T02 a view requirement is built only by a UI component that builds it, not by one that only renders its view', async () => {
    expect(obligation(clean, 'EX-LEND', 'view_requirement')).toMatchObject(covered(1));
    const rendered = await loadData(without(complete(), 'builds', () => true));
    // The component that only renders the view builds nothing, so no obligation's chain reaches it either.
    expect(gaps(rendered)).toEqual(['built EX-V01-R01', 'record-untraced EX-UI01']);
    expect(obligation(await loadData(complete(), { missing: ['web/catalog.tsx'] }), 'EX-LEND', 'view_requirement')).toMatchObject({ designed: 1, built: 0 });
  });

  it("LA-TRC-UC02-R10-T01 a UC requirement is built by the adapter of an integration its step exchanges with; a product kind's record under it builds nothing", async () => {
    // The one step that fulfills UC01-R01 invokes nothing; it exchanges with the mail integration.
    let alone = without(complete(), 'fulfills', (r) => r.source_id === 'EX-LEND-UC01-FL-S02');
    alone = without(alone, 'invokes', (r) => r.source_id === 'EX-LEND-UC01-FL-S01');
    const exchanging = adding(alone, { exchanges_with: [{ source_id: 'EX-LEND-UC01-FL-S01', target_id: 'EX-INT01' }] });
    expect(obligation(await loadData(exchanging), 'EX-LEND', 'uc_requirement')).toMatchObject(covered(2));
    expect(gaps(await loadData(exchanging, { missing: ['src/mail.ts'] }))).toContain('built EX-LEND-UC01-R01');
    // With no adapter, a hook of the product's own kind under the integration does not build it.
    const hooked = adding(without(exchanging, 'adapter', () => true), {
      product_kind: [{ name: 'hook', product_id: 'EX', label: 'Hook', description: 'Code the mail service calls.', parent_kind: 'integration', stage: 'technical-specification', obligation: false, complexity: 'accidental' }],
      product_kind_field: [{ kind: 'hook', position: 1, name: 'file', type: 'text', required: true, description: 'The file.' }],
      hook: [{ id: 'EX-INT01-HK01', title: 'On bounce', integration_id: 'EX-INT01', file: 'src/bounce.ts' }],
    });
    expect(gaps(await loadData(hooked))).toContain('built EX-LEND-UC01-R01');
    expect(gaps(await loadData(alone))).toContain('built EX-LEND-UC01-R01');
  });

  it('LA-TRC-UC02-R15-T01 a policy that exchanges with an integration is built by its event handler and that integration\'s adapter', async () => {
    const exchanging = adding(complete(), { exchanges_with: [{ source_id: 'EX-LEND-PO01', target_id: 'EX-INT01' }] });
    const ws = await loadData(exchanging);
    expect(obligation(ws, 'EX-LEND', 'policy')).toMatchObject(covered(1));
    expect(ws.chains.find((c) => c.obligation === 'EX-LEND-PO01')).toMatchObject({
      design: expect.arrayContaining(['EX-LEND-CMD03', 'EX-INT01']),
      build: expect.arrayContaining(['EX-LEND-PO01-H', 'EX-INT01-AD']),
      links: expect.arrayContaining([['EX-LEND-PO01', 'EX-INT01'], ['EX-INT01', 'EX-INT01-AD']]),
    });
    // The adapter's file missing, the policy is not built, though its event handler's file exists.
    expect(gaps(await loadData(exchanging, { missing: ['src/mail.ts'] }))).toContain('built EX-LEND-PO01');
    // Without the exchange, the adapter builds nothing of the policy.
    expect(gaps(await loadData(complete(), { missing: ['src/mail.ts'] }))).not.toContain('built EX-LEND-PO01');
  });
});

describe('chains', () => {
  const chain = (ws: Workspace, id: string) => ws.chains.find((c) => c.obligation === id)!;

  it("LA-TRC-UC10-R05-T01 each obligation's chain holds what designs it, what builds it as built counts, its tests and their files, link by link", () => {
    // A UC requirement: its fulfilling steps, their flow, what they invoke and the integration
    // they exchange with; the handlers, the predicate and service its command rests on, and the adapter that build it;
    // its test.
    const req = chain(clean, 'EX-LEND-UC01-R01');
    expect(new Set(req.design)).toEqual(new Set(['EX-INT01', 'EX-LEND-UC01-FL', 'EX-LEND-UC01-FL-S01', 'EX-LEND-UC01-FL-S02', 'EX-LEND-CMD01', 'EX-LEND-QRY01']));
    expect(new Set(req.build)).toEqual(new Set(['EX-LEND-CMD01-H', 'EX-LEND-QRY01-H', 'EX-INT01-AD', 'EX-LEND-SP01-PR', 'EX-LEND-DS01-SV']));
    expect(req.tests).toEqual(['EX-LEND-UC01-R01-T01']);
    expect(req.links).toEqual(expect.arrayContaining([
      ['EX-LEND-UC01-R01', 'EX-LEND-UC01-FL'], ['EX-LEND-UC01-FL', 'EX-LEND-UC01-FL-S01'], ['EX-LEND-UC01-FL-S01', 'EX-LEND-CMD01'],
      ['EX-LEND-CMD01', 'EX-LEND-CMD01-H'], ['EX-LEND-CMD01', 'EX-LEND-SP01-PR'], ['EX-LEND-CMD01', 'EX-LEND-DS01-SV'], ['EX-LEND-UC01-FL-S02', 'EX-INT01'], ['EX-INT01', 'EX-INT01-AD'], ['EX-LEND-UC01-R01', 'EX-LEND-UC01-R01-T01'],
    ]));
    expect(req.files.find((f) => f.path === 'test/api.test.ts')?.named_by).toEqual(['EX-LEND-UC01-R01-T01']);
    // A view requirement: the UI component that builds it; an invariant: its rule.
    expect(chain(clean, 'EX-V01-R01')).toMatchObject({ build: ['EX-UI01'], links: expect.arrayContaining([['EX-V01-R01', 'EX-UI01']]) });
    expect(chain(clean, 'EX-LEND-INV01')).toMatchObject({ build: ['EX-LEND-INV01-RL'], links: expect.arrayContaining([['EX-LEND-INV01', 'EX-LEND-INV01-RL']]) });
    // A policy: its command, then its event handler; a constraint its value object, then its value type.
    expect(chain(clean, 'EX-LEND-PO01')).toMatchObject({ design: ['EX-LEND-CMD03'], build: ['EX-LEND-PO01-H'], tests: ['EX-LEND-PO01-T'] });
    expect(chain(clean, 'EX-VO01-C01').links).toEqual(expect.arrayContaining([['EX-VO01-C01', 'EX-VO01'], ['EX-VO01', 'EX-VO01-VT']]));
    // Every obligation has a chain, and only obligations do.
    expect(clean.chains.map((c) => c.obligation).sort()).toEqual(clean.records.filter((r) => clean.kinds.find((k) => k.kind === r.kind)?.obligation).map((r) => r.id).sort());
  });

  it("LA-TRC-UC10-R05-T02 a flow step, command, query or UI component no obligation's chain reaches is a record-untraced gap", async () => {
    // The complete product: everything is reached, a policy's command through the policy.
    expect(gaps(clean).filter((g) => g.startsWith('record-untraced'))).toEqual([]);
    let data = without(complete(), 'fulfills', (r) => r.source_id === 'EX-LEND-UC01-FL-S02');
    data = adding(data, {
      command: [{ id: 'EX-LEND-CMD09', title: 'Forget a tool', entity_id: 'EX-LEND-EN01', description: 'Drops a tool from its loans.' }],
      command_handler: [{ id: 'EX-LEND-CMD09-H', title: 'forgetTool', command_id: 'EX-LEND-CMD09', file: 'src/tools.ts', description: 'Deletes the rows in one transaction.' }],
      ui_component: [{ id: 'EX-UI02', title: 'Unused page', file: 'web/catalog.tsx', description: 'A page no view uses.' }],
    });
    const ws = await loadData(data);
    // A step that fulfills nothing, a command nothing invokes or presents and a UI component that builds no view
    // requirement; never the handlers, the integration's test or a flow test. The query only that step invokes is
    // still reached: the catalog, a view with a requirement, presents it.
    expect(gaps(ws).filter((g) => g.startsWith('record-untraced'))).toEqual([
      'record-untraced EX-LEND-CMD09', 'record-untraced EX-LEND-UC01-FL-S02', 'record-untraced EX-UI02',
    ]);
    // A command a view presents is reached through the view's requirements, as an editor form reaches the Change and
    // Remove commands no flow step invokes.
    const presented = await loadData(adding(data, { presents: [{ source_id: 'EX-V01', target_id: 'EX-LEND-CMD09' }] }));
    expect(gaps(presented).filter((g) => g.startsWith('record-untraced'))).toEqual(['record-untraced EX-LEND-UC01-FL-S02', 'record-untraced EX-UI02']);
    expect(presented.chains.find((c) => c.obligation === 'EX-V01-R01')?.design).toContain('EX-LEND-CMD09');
    // So is one a record of the product's own kind presents, once a design link ties that record to an obligation: a
    // command line's invocation that is how the product meets a pattern rule. Presenting alone reaches nothing.
    const invoked = (links: Data) =>
      adding(data, {
        product_kind: [{ name: 'cli_call', product_id: 'EX', label: 'CLI call', description: 'A command of the command line.', parent_kind: 'command', stage: 'interaction-design', obligation: false, complexity: 'essential' }],
        product_relation: [
          { name: 'presents', source_kind: 'cli_call', target_kind: 'command', product_id: 'EX', forward_label: 'Presents', reverse_label: 'Presented in', description: 'The call sends its command.' },
          { name: 'realizes', source_kind: 'cli_call', target_kind: 'pattern_rule', product_id: 'EX', role: 'design', forward_label: 'Realizes', reverse_label: 'Realized by', description: 'The call is how the command line meets the rule.' },
        ],
        cli_call: [{ id: 'EX-LEND-CMD09-CLI', title: 'tools forget', command_id: 'EX-LEND-CMD09' }],
        presents: [{ source_id: 'EX-LEND-CMD09-CLI', target_id: 'EX-LEND-CMD09' }],
        ...links,
      });
    const unrealized = await loadData(invoked({}));
    expect(gaps(unrealized).filter((g) => g.startsWith('record-untraced'))).toContain('record-untraced EX-LEND-CMD09');
    const realized = await loadData(invoked({ realizes: [{ source_id: 'EX-LEND-CMD09-CLI', target_id: 'EX-PAT-ACT-R01' }] }));
    expect(gaps(realized).filter((g) => g.startsWith('record-untraced'))).toEqual(['record-untraced EX-LEND-UC01-FL-S02', 'record-untraced EX-UI02']);
    expect(realized.chains.find((c) => c.obligation === 'EX-PAT-ACT-R01')?.design).toEqual(expect.arrayContaining(['EX-LEND-CMD09-CLI', 'EX-LEND-CMD09']));
    expect(ws.coverage.flatMap((c) => c.gaps).find((g) => g.id === 'EX-LEND-UC01-FL-S02')).toEqual({
      id: 'EX-LEND-UC01-FL-S02', kind: 'flow_step', missing: 'record-untraced',
      message: "Flow step EX-LEND-UC01-FL-S02 is untraced: no obligation's chain reaches it, as it fulfills no UC requirement.",
    });
    expect(ws.coverage.flatMap((c) => c.gaps).find((g) => g.id === 'EX-UI02')?.message).toBe("UI component EX-UI02 is untraced: no obligation's chain reaches it, as it builds no view requirement.");
    // It is a gap, never a problem.
    expect(ws.problems.filter((p) => p.record === 'EX-LEND-UC01-FL-S02')).toEqual([]);
  });
});

describe('proved', () => {
  let ws: Workspace;
  beforeAll(async () => {
    let data = changing(complete(), 'constraint_test', () => true, { level: 'service' });
    data = changing(data, 'specification_test', () => true, { state: 'not automated yet' });
    data = changing(data, 'view_test', () => true, { level: 'browser', state: 'manual', manual_reason: 'Looked at by eye.', file: undefined });
    data = without(data, 'standard_rule_test', () => true);
    ws = await loadData(data, { silent: ['EX-LEND-PO01-T'] });
  });

  it('LA-TRC-UC02-R03-T01 only an automated or manual test at an allowed level, whose file names it, proves', () => {
    expect(gaps(ws)).toEqual(['proved EX-LEND-PO01', 'proved EX-LEND-SP01', 'proved EX-STD-CODE-R01', 'proved EX-VO01-C01']);
    // A manual test proves.
    expect(obligation(ws, 'EX-LEND', 'view_requirement')).toMatchObject(covered(1));
  });

  it('LA-TRC-UC02-R07-T01 a test at a level its kind does not allow proves nothing', () => {
    // The constraint's test runs at api, which a constraint test does not allow.
    expect(obligation(ws, 'EX-LEND', 'constraint')).toMatchObject({ total: 1, proved: 0 });
    expect(ws.coverage.find((c) => c.domain === 'EX-LEND')?.gaps.find((g) => g.id === 'EX-VO01-C01')?.missing).toBe('proved');
  });

  it('LA-TRC-UC01-R02-T02 an automated test whose file does not name it leaves its obligation unproved, listed as a gap', () => {
    expect(ws.coverage[0].gaps.find((g) => g.id === 'EX-LEND-PO01')).toEqual({ id: 'EX-LEND-PO01', kind: 'policy', missing: 'proved', message: 'Policy EX-LEND-PO01 is not proved yet.' });
  });

  it('LA-TRC-UC02-R03-T01 a test not automated yet leaves its obligation unproved, counted and named as such', () => {
    expect(obligation(ws, 'EX-LEND', 'specification')).toMatchObject({ total: 1, proved: 0, not_automated: 1 });
    expect(ws.coverage[0].gaps.find((g) => g.id === 'EX-LEND-SP01')?.message).toBe('Specification EX-LEND-SP01 is not proved yet: its test is not automated yet.');
    expect(ws.coverage[0].tests).toEqual({ automated: 10, manual: 3, not_automated: 1 });
  });

  it('LA-TEC-UC16-R02-T03 a standard rule with no standard rule test is not proved', () => {
    expect(obligation(ws, null, 'standard_rule')).toMatchObject({ total: 1, designed: 1, built: 1, proved: 0 });
  });
});

describe('pattern rules', () => {
  const shop = (data = complete()) =>
    adding(data, {
      domain: [{ id: 'EX-SHOP', title: 'Shop', product_id: 'EX', position: 2, subdomain_type: 'supporting', description: 'Selling spare parts.' }],
      capability: [{ id: 'EX-SHOP-CAP01', title: 'Selling', domain_id: 'EX-SHOP', position: 1, description: 'Selling tools.' }],
      use_case: [{ id: 'EX-SHOP-UC01', title: 'Sell a tool', capability_id: 'EX-SHOP-CAP01', goal: 'A customer buys a used tool.' }],
    });

  it("LA-TRC-SP04-T each domain that follows a pattern owes its rules, proved only by its own pattern rule test", async () => {
    const data = adding(shop(), {
      follows: [{ source_id: 'EX-SHOP-UC01', target_id: 'EX-PAT-ACT' }],
      setting_value: [{ follower_id: 'EX-SHOP-UC01', pattern_id: 'EX-PAT-ACT', setting: 'record', value: 'Sale' }],
    });
    const ws = await loadData(data);
    expect(obligation(ws, 'EX-LEND', 'pattern_rule')).toMatchObject({ proof_only: true, ...covered(1) });
    expect(obligation(ws, 'EX-SHOP', 'pattern_rule')).toMatchObject({ total: 1, designed: 1, built: 1, proved: 0 });
    expect(ws.coverage.find((c) => c.domain === 'EX-SHOP')?.gaps.find((g) => g.missing === 'proved')?.message).toBe('Pattern rule EX-PAT-ACT-R01 is not proved yet in EX-SHOP.');
  });

  it('LA-TRC-UC04-R02-T01 a domain that does not follow the pattern owes none of its rules', async () => {
    const ws = await loadData(shop());
    expect(obligation(ws, 'EX-SHOP', 'pattern_rule')).toMatchObject({ total: 0 });
  });

  it('LA-TRC-UC07-R01-T01 a domain that follows the pattern itself owes every one of its rules', async () => {
    const itself = await loadData(adding(complete(), {
      pattern: [{ id: 'EX-PAT-LOG', title: 'Logged action', product_id: 'EX', description: 'An action written to the log.' }],
      pattern_rule: [{ id: 'EX-PAT-LOG-R01', title: 'Each action is logged', pattern_id: 'EX-PAT-LOG', statement: 'Each action MUST be logged.' }],
      follows: [{ source_id: 'EX-LEND', target_id: 'EX-PAT-LOG' }],
    }));
    expect(obligation(itself, 'EX-LEND', 'pattern_rule')).toMatchObject({ total: 2, proved: 1 });
    expect(itself.coverage.find((c) => c.domain === 'EX-LEND')?.pattern_rules).toEqual(['EX-PAT-ACT-R01', 'EX-PAT-LOG-R01']);
  });

});

describe('LA-TRC-UC01-R05-T01 minimums', () => {
  it('a record short of each minimum is a gap, under its own scope, named by the rule', async () => {
    // A source file no record names, for code-file-untraced, a route no endpoint has, for route-without-record, and a
    // package no record names, for package-not-accounted-for.
    const ws = await loadData(sparse(), { files: { ...SPARSE_FILES.files, 'src/orphan.ts': 'export {};\n', 'package.json': '{ "dependencies": { "left-pad": "^1.3.0" } }\n' } });
    const found = new Set(ws.coverage.flatMap((c) => c.gaps.map((g) => g.missing)));
    for (const rule of GAP_RULES) expect(found.has(rule.name), rule.name).toBe(true);
    // A view's gap is the domain's whose command or query it presents, as a use case's is its domain's.
    expect(ws.coverage.find((c) => c.domain === 'SP-D')?.gaps).toContainEqual({ id: 'SP-V01', kind: 'view', missing: 'view-without-ui-component', message: 'View SP-V01 is rendered by no UI component.' });
    expect(ws.coverage.find((c) => c.domain === 'SP-D')?.gaps).toContainEqual({ id: 'SP-D-UC01', kind: 'use_case', missing: 'use-case-without-flow', message: 'Use case SP-D-UC01 has no flow.' });
    expect(ws.coverage.find((c) => c.domain === 'SP-E')?.gaps).toEqual([{ id: 'SP-E', kind: 'domain', missing: 'domain-without-aggregate', message: 'Domain SP-E has no aggregate.' }]);
    // An endpoint owes an API requirement only where its product has a public API: without one, its endpoints are
    // held to their pattern's rules alone.
    const endpointGaps = (w: Workspace) => w.coverage.flatMap((c) => c.gaps).filter((g) => g.missing === 'endpoint-without-requirement').map((g) => g.id).sort();
    expect(endpointGaps(ws)).toEqual(['SP-D-EP01', 'SP-D-EP02']);
    const privateApi = await loadData(changing(sparse(), 'interface', (r) => r.id === 'SP-IF03', { public: false }), { files: SPARSE_FILES.files });
    expect(endpointGaps(privateApi)).toEqual([]);
    // Gaps are coverage, never problems; the sparse product serves no outcome, so what it holds is warned of apart
    // (serves-no-outcome), and accounts for none of its accidental records (accidental-not-accounted-for).
    expect(ws.problems.filter((p) => !['serves-no-outcome', 'accidental-not-accounted-for'].includes(p.check)).map((p) => p.check).sort()).toEqual(['journey-of-one-use-case', 'not-built', 'not-built', 'not-built', 'not-proved', 'not-proved', 'not-proved', 'outcome-target-undated', 'pattern-not-followed', 'value-object-unused']);
  });

  it('LA-TRC-UC22-R03-T01 a journey without a test, one with no main path, one serving no outcome and a step carrying out nothing are each a gap saying what to write', async () => {
    expect(gaps(await loadData(withJourney()))).toEqual([]);
    const data = adding(without(withJourney(), 'journey_test', () => true), {
      journey: [{ id: 'EX-JR02', title: 'Borrow a tool and bring it back', product_id: 'EX', trigger: 'A member wants a tool.', result: 'The tool is back on the shelf.' }],
      journey_step: [{ id: 'EX-JR02-S01', title: 'A member brings the tool back', journey_id: 'EX-JR02', path: 'late', position: 1 }],
      journey_test: [{ id: 'EX-JR02-T', title: 'A tool comes back', journey_id: 'EX-JR02', level: 'system', state: 'manual', manual_reason: 'Done at the desk.', steps: ['Borrow a tool', 'Bring it back'], expected_result: 'The tool is on the shelf.' }],
    });
    const product = (await loadData(data)).coverage.find((c) => c.domain === null)!.gaps.filter((g) => g.missing.startsWith('journey'));
    expect(product).toEqual([
      { id: 'EX-JR01', kind: 'journey', missing: 'journey-without-test', message: 'Journey EX-JR01 has no journey test: add the one that drives its main path from its trigger to its result.' },
      { id: 'EX-JR02', kind: 'journey', missing: 'journey-serves-no-outcome', message: 'Journey EX-JR02 serves no business outcome: link the outcome its result moves.' },
      { id: 'EX-JR02', kind: 'journey', missing: 'journey-without-main-path', message: 'Journey EX-JR02 has no step on its main path: write the steps from its trigger to its result.' },
      { id: 'EX-JR02-S01', kind: 'journey_step', missing: 'journey-step-unlinked', message: 'Journey step EX-JR02-S01 carries out no use case or policy yet: write the use case (or the policy, for a handoff) and link the step.' },
    ]);
    // A journey serving an outcome no capability serves leaves that outcome unserved: capabilities group, journeys order.
    const byJourneyAlone = without(withJourney(), 'serves', (r) => r.source_id === 'EX-LEND-CAP01' && r.target_id === 'EX-BO02');
    expect(gaps(await loadData(byJourneyAlone))).toEqual(['outcome-not-served EX-BO02']);
  });

  it('LA-PRD-UC33-R05-T02 a journey test proves only at the service, system or browser level', async () => {
    expect(ALLOWED_LEVELS.journey_test).toEqual(['service', 'system', 'browser']);
    const unit = changing(withJourney(), 'journey_test', () => true, { level: 'unit' });
    expect(records(ofCheck(await loadData(unit), 'test-level-not-allowed'))).toEqual(['EX-JR01-T']);
  });

  it('every gap rule has a unique name, a stage and a summary, and the complete product meets every minimum', () => {
    expect(new Set(GAP_RULES.map((g) => g.name)).size).toBe(GAP_RULES.length);
    for (const g of GAP_RULES) expect(g.summary, g.name).toMatch(/^An? .+\.$/);
    expect(gaps(clean)).toEqual([]);
  });

  it('an entity kept in its root\'s table needs no table of its own', async () => {
    const ws = await loadData(changing(complete(), 'entity', (r) => r.id === 'EX-LEND-EN02', { in_root_table: undefined }));
    expect(gaps(ws)).toEqual(['entity-without-table EX-LEND-EN02']);
  });
});

describe("a product's own obligation kinds", () => {
  const houseRules = () =>
    adding(complete(), {
      product_kind: [
        { name: 'house_rule', product_id: 'EX', label: 'House rule', description: 'A rule of the house.', parent_kind: 'domain', stage: 'use-cases', obligation: true, complexity: 'essential' },
        { name: 'script', product_id: 'EX', label: 'Script', description: 'A script.', parent_kind: 'domain', stage: 'technical-specification', obligation: false, complexity: 'accidental' },
      ],
      product_kind_field: [{ kind: 'script', position: 1, name: 'file', type: 'text', required: true, description: 'The file.' }],
      product_relation: [
        { name: 'enforces', source_kind: 'script', target_kind: 'house_rule', product_id: 'EX', role: 'design', forward_label: 'Enforces', reverse_label: 'Enforced by', description: 'The script enforces the rule.' },
        { name: 'checks_rule', source_kind: 'use_case_test', target_kind: 'house_rule', product_id: 'EX', role: 'proof', forward_label: 'Checks', reverse_label: 'Checked by', description: 'The test checks the rule.' },
      ],
      house_rule: [
        { id: 'EX-LEND-HR01', title: 'Quiet', domain_id: 'EX-LEND' },
        { id: 'EX-LEND-HR02', title: 'Tidy', domain_id: 'EX-LEND' },
      ],
      script: [{ id: 'EX-LEND-SC01', title: 'quiet.sh', domain_id: 'EX-LEND', file: 'bin/quiet.sh' }],
      enforces: [{ source_id: 'EX-LEND-SC01', target_id: 'EX-LEND-HR01' }],
      checks_rule: [{ source_id: 'EX-LEND-UC01-R01-T01', target_id: 'EX-LEND-HR01' }],
    });

  it('LA-TRC-UC02-R02-T01 are designed, built and proved through its design and proof links', async () => {
    const ws = await loadData(houseRules());
    expect(obligation(ws, 'EX-LEND', 'house_rule')).toMatchObject({ label: 'House rule', total: 2, designed: 1, built: 1, proved: 1 });
  });

  it("LA-TRC-UC02-R06-T01 are obligations as the product's kind declares, counted after Lathe's", async () => {
    const ws = await loadData(houseRules());
    expect(ws.kinds.find((k) => k.kind === 'house_rule')?.obligation).toBe(true);
    expect(ws.kinds.find((k) => k.kind === 'script')?.obligation).toBe(false);
    expect(ws.coverage[0].obligations.at(-1)?.kind).toBe('house_rule');
    expect(obligation(ws, 'EX-LEND', 'script')).toBeUndefined();
  });

  it('LA-TRC-UC02-R09-T01 are proved by a product kind that names a file only when the file names it', async () => {
    const data = adding(houseRules(), {
      product_kind: [
        { name: 'rule_check', product_id: 'EX', label: 'Rule check', description: 'A script that checks a rule.', parent_kind: 'domain', stage: 'test-plan', obligation: false, complexity: 'as-parent' },
        { name: 'sign_off', product_id: 'EX', label: 'Sign-off', description: 'A person signing a rule off.', parent_kind: 'domain', stage: 'test-plan', obligation: false, complexity: 'as-parent' },
      ],
      product_kind_field: [{ kind: 'rule_check', position: 1, name: 'file', type: 'text', required: true, description: 'The file that runs it.' }],
      product_relation: [
        { name: 'checks_by_script', source_kind: 'rule_check', target_kind: 'house_rule', product_id: 'EX', role: 'proof', forward_label: 'Checks', reverse_label: 'Checked by', description: 'The script checks the rule.' },
        { name: 'signs_off', source_kind: 'sign_off', target_kind: 'house_rule', product_id: 'EX', role: 'proof', forward_label: 'Signs off', reverse_label: 'Signed off by', description: 'The person signs the rule off.' },
      ],
      house_rule: [{ id: 'EX-LEND-HR03', title: 'Calm', domain_id: 'EX-LEND' }],
      rule_check: [{ id: 'EX-LEND-RC01', title: 'tidy.sh', domain_id: 'EX-LEND', file: 'test/tidy.sh' }],
      sign_off: [{ id: 'EX-LEND-SO01', title: 'Calm signed off', domain_id: 'EX-LEND' }],
      checks_by_script: [{ source_id: 'EX-LEND-RC01', target_id: 'EX-LEND-HR02' }],
      signs_off: [{ source_id: 'EX-LEND-SO01', target_id: 'EX-LEND-HR03' }],
    });
    // HR01 by a use case test, HR02 by the script whose file names it, HR03 by a sign-off that names no file.
    expect(obligation(await loadData(data), 'EX-LEND', 'house_rule')).toMatchObject({ total: 3, proved: 3 });
    // The script's file exists but leaves its ID out, so it no longer proves HR02; the sign-off still counts.
    expect(obligation(await loadData(data, { silent: ['EX-LEND-RC01'] }), 'EX-LEND', 'house_rule')).toMatchObject({ total: 3, proved: 2 });
  });
});

describe("a product's relations with a role, on Lathe's own obligation kinds", () => {
  // The standard rule loses what meets it and its own test, so only the product's links can cover it.
  const bareRule = () => without(without(complete(), 'meets', () => true), 'standard_rule_test', () => true);
  const script = {
    product_kind: [{ name: 'script', product_id: 'EX', label: 'Script', description: 'A script.', parent_kind: 'domain', stage: 'technical-specification', obligation: false, complexity: 'accidental' }],
    product_kind_field: [{ kind: 'script', position: 1, name: 'file', type: 'text', required: true, description: 'The file.' }],
    script: [{ id: 'EX-LEND-SC01', title: 'quiet.sh', domain_id: 'EX-LEND', file: 'bin/quiet.sh' }],
  };

  it('LA-TRC-UC02-R14-T01 a design link designs the rule and builds nothing', async () => {
    expect(obligation(await loadData(bareRule()), null, 'standard_rule')).toMatchObject({ total: 1, designed: 0, built: 0, proved: 0 });
    const data = adding(bareRule(), {
      ...script,
      product_relation: [{ name: 'enforces', source_kind: 'script', target_kind: 'standard_rule', product_id: 'EX', role: 'design', forward_label: 'Enforces', reverse_label: 'Enforced by', description: 'The script enforces the rule.' }],
      enforces: [{ source_id: 'EX-LEND-SC01', target_id: 'EX-STD-CODE-R01' }],
    });
    const ws = await loadData(data);
    expect(obligation(ws, null, 'standard_rule')).toMatchObject({ total: 1, designed: 1, built: 0, proved: 0 });
    expect(ofCheck(ws, 'not-designed').map((p) => p.record)).not.toContain('EX-STD-CODE-R01');
  });

  it('LA-TRC-UC02-R14-T02 a build link builds the rule once its source names a file that exists', async () => {
    const data = adding(bareRule(), {
      ...script,
      product_relation: [{ name: 'runs_as', source_kind: 'script', target_kind: 'standard_rule', product_id: 'EX', role: 'build', forward_label: 'Runs as', reverse_label: 'Run by', description: 'The script is the code that follows the rule.' }],
      runs_as: [{ source_id: 'EX-LEND-SC01', target_id: 'EX-STD-CODE-R01' }],
    });
    expect(obligation(await loadData(data), null, 'standard_rule')).toMatchObject({ total: 1, designed: 1, built: 1, proved: 0 });
    expect(obligation(await loadData(data, { missing: ['bin/quiet.sh'] }), null, 'standard_rule')).toMatchObject({ total: 1, designed: 1, built: 0 });
  });

  it('LA-TRC-UC02-R14-T03 a proof link proves the rule', async () => {
    const data = adding(bareRule(), {
      product_relation: [{ name: 'checks_rule', source_kind: 'use_case_test', target_kind: 'standard_rule', product_id: 'EX', role: 'proof', forward_label: 'Checks', reverse_label: 'Checked by', description: 'The test checks the rule.' }],
      checks_rule: [{ source_id: 'EX-LEND-UC01-R01-T01', target_id: 'EX-STD-CODE-R01' }],
    });
    expect(obligation(await loadData(data), null, 'standard_rule')).toMatchObject({ total: 1, designed: 0, proved: 1 });
  });
});

describe('pattern rules, domain by domain', () => {
  const shop = (data = complete()) =>
    adding(data, {
      domain: [{ id: 'EX-SHOP', title: 'Shop', product_id: 'EX', position: 2, subdomain_type: 'supporting', description: 'Selling spare parts.' }],
      capability: [{ id: 'EX-SHOP-CAP01', title: 'Selling', domain_id: 'EX-SHOP', position: 1, description: 'Selling tools.' }],
      use_case: [
        { id: 'EX-SHOP-UC01', title: 'Sell a tool', capability_id: 'EX-SHOP-CAP01', goal: 'A customer buys a used tool.' },
        { id: 'EX-SHOP-UC02', title: 'Price a tool', capability_id: 'EX-SHOP-CAP01', goal: 'The clerk sets the price of a used tool.' },
      ],
    });
  /** A second pattern of the complete product, with no settings and one rule. */
  const logged = (data = complete()) =>
    adding(data, {
      pattern: [{ id: 'EX-PAT-LOG', title: 'Logged action', product_id: 'EX', description: 'An action written to the log.' }],
      pattern_rule: [{ id: 'EX-PAT-LOG-R01', title: 'Each action is logged', pattern_id: 'EX-PAT-LOG', statement: 'Each action MUST be logged.' }],
    });
  /** A follower of EX-PAT-ACT with its value of record. */
  const sale = (follower: string, value: string): Data => ({
    follows: [{ source_id: follower, target_id: 'EX-PAT-ACT' }],
    setting_value: [{ follower_id: follower, pattern_id: 'EX-PAT-ACT', setting: 'record', value }],
  });
  const merge = (...parts: Data[]) => parts.reduce((all, part) => adding(all, part), {} as Data);

  it('LA-TRC-UC04-R01-T01 a pattern rule sits under a pattern and is an obligation counted for proof alone', async () => {
    expect(clean.kinds.find((k) => k.kind === 'pattern_rule')).toMatchObject({ obligation: true });
    const ws = await loadData(without(complete(), 'pattern_rule_test', () => true));
    // Nothing designs or builds a pattern rule, and it is still designed and built: only its proof is missing.
    expect(obligation(ws, 'EX-LEND', 'pattern_rule')).toMatchObject({ proof_only: true, total: 1, designed: 1, built: 1, proved: 0 });
    expect(gaps(ws)).toEqual(['proved EX-PAT-ACT-R01']);
  });

  it("LA-TRC-UC04-R03-T01 a domain's own pattern rule test proves the rule there and nowhere else; one not automated yet leaves it not automated", async () => {
    const data = adding(shop(), sale('EX-SHOP-UC01', 'Sale'));
    const ws = await loadData(data);
    expect(obligation(ws, 'EX-LEND', 'pattern_rule')).toMatchObject(covered(1));
    expect(obligation(ws, 'EX-SHOP', 'pattern_rule')).toMatchObject({ total: 1, proved: 0, not_automated: 0 });
    const planned = adding(data, { pattern_rule_test: [{ id: 'EX-PAT-ACT-R01-T02', title: 'A sale reads the same', pattern_rule_id: 'EX-PAT-ACT-R01', domain_id: 'EX-SHOP', level: 'service', state: 'not automated yet', when: 'The clerk saves a sale.', then: 'The sale reads the same everywhere.' }] });
    expect(obligation(await loadData(planned), 'EX-SHOP', 'pattern_rule')).toMatchObject({ total: 1, proved: 0, not_automated: 1 });
  });

  it('LA-TRC-UC04-R05-T01 a not-proved warning names the pattern rule and each domain that owes it, and says when its test there is not automated yet', async () => {
    const data = adding(shop(), merge(sale('EX-SHOP-UC01', 'Sale'), sale('EX-SHOP', 'Sale')));
    const unproved = without(data, 'pattern_rule_test', () => true);
    expect(ofCheck(await loadData(unproved), 'not-proved').map((p) => p.message)).toEqual([
      'Pattern rule EX-PAT-ACT-R01 is not proved yet in EX-LEND.',
      'Pattern rule EX-PAT-ACT-R01 is not proved yet in EX-SHOP.',
    ]);
    const planned = changing(data, 'pattern_rule_test', () => true, { state: 'not automated yet', file: undefined });
    expect(ofCheck(await loadData(planned), 'not-proved').map((p) => p.message)).toEqual([
      'Pattern rule EX-PAT-ACT-R01 is not proved yet in EX-LEND: its test is not automated yet.',
      'Pattern rule EX-PAT-ACT-R01 is not proved yet in EX-SHOP.',
    ]);
  });

  it("LA-TRC-UC04-R08-T01 an obligation outside every domain counts in the product's Shared coverage, and a pattern rule never does", async () => {
    const data = adding(complete(), {
      product_kind: [{ name: 'house_rule', product_id: 'EX', label: 'House rule', description: 'A rule of the house.', parent_kind: 'product', stage: 'use-cases', obligation: true, complexity: 'essential' }],
      house_rule: [{ id: 'EX-HR01', title: 'Quiet', product_id: 'EX' }],
    });
    const ws = await loadData(data);
    expect(obligation(ws, null, 'house_rule')).toMatchObject({ total: 1, proved: 0 });
    expect(obligation(ws, null, 'pattern_rule')).toMatchObject({ total: 0 });
    expect(records(ofCheck(ws, 'not-proved'))).toEqual(['EX-HR01']);
  });

  it('LA-TRC-SP01-T a domain follows a pattern itself or through any of its use cases', async () => {
    // EX-LEND follows EX-PAT-ACT through its use case, and EX-PAT-LOG itself.
    const ws = await loadData(adding(logged(), { follows: [{ source_id: 'EX-LEND', target_id: 'EX-PAT-LOG' }] }));
    expect(obligation(ws, 'EX-LEND', 'pattern_rule')).toMatchObject({ total: 2, proved: 1 });
    expect(ws.coverage.find((c) => c.domain === 'EX-LEND')?.gaps.map((g) => g.id)).toEqual(['EX-PAT-LOG-R01']);
    // A domain that follows neither owes neither.
    expect(ws.coverage.find((c) => c.domain === null)?.pattern_rules).toEqual([]);
  });

  it('LA-TRC-UC07-R02-T01 a domain following a pattern itself and through a use case counts each rule once', async () => {
    const both = await loadData(adding(complete(), { follows: [{ source_id: 'EX-LEND', target_id: 'EX-PAT-ACT' }] }));
    expect(obligation(both, 'EX-LEND', 'pattern_rule')).toMatchObject(covered(1));
    expect(both.coverage.find((c) => c.domain === 'EX-LEND')?.pattern_rules).toEqual(['EX-PAT-ACT-R01']);
    // Two use cases of one domain following it count it once there too.
    const twice = await loadData(adding(shop(), merge(sale('EX-SHOP-UC01', 'Sale'), sale('EX-SHOP-UC02', 'Price'))));
    expect(obligation(twice, 'EX-SHOP', 'pattern_rule')).toMatchObject({ total: 1 });
  });

  it('LA-TRC-UC07-R02-T01 a domain owes the rules of a pattern an interface follows once, when the interface offers one of its use cases', async () => {
    const followed = adding(complete(), {
      pattern: [{ id: 'EX-PAT-IFC', title: 'Desk app', product_id: 'EX', description: 'How a step is carried out in the desk app.' }],
      pattern_rule: [{ id: 'EX-PAT-IFC-R01', title: 'A refusal is shown in place', pattern_id: 'EX-PAT-IFC', statement: 'A refusal MUST be shown beside the field it names.', group_name: 'Refusal' }],
      follows: [{ source_id: 'EX-IF01', target_id: 'EX-PAT-IFC' }],
    });
    const owing = await loadData(followed);
    expect(owing.coverage.find((c) => c.domain === 'EX-LEND')?.pattern_rules).toEqual(['EX-PAT-ACT-R01', 'EX-PAT-IFC-R01']);
    expect(gaps(owing)).toContain('proved EX-PAT-IFC-R01');
    // An interface that offers no use case of the domain does not make it owe the rules.
    const idle = await loadData(without(followed, 'offers', () => true));
    expect(idle.coverage.find((c) => c.domain === 'EX-LEND')?.pattern_rules).toEqual(['EX-PAT-ACT-R01']);
  });

  it('LA-TRC-UC07-R03-T01 a pattern may have no settings: its followers give none, and its rules are owed wherever it is followed', async () => {
    const data = adding(logged(), { follows: [{ source_id: 'EX-LEND-UC01', target_id: 'EX-PAT-LOG' }, { source_id: 'EX-LEND', target_id: 'EX-PAT-LOG' }] });
    const ws = await loadData(data);
    expect(ofCheck(ws, 'pattern-setting-missing')).toEqual([]);
    expect(obligation(ws, 'EX-LEND', 'pattern_rule')).toMatchObject({ total: 2, proved: 1 });
  });

  it("LA-TRC-INV02-T a setting takes one value from each follower: a second value of one setting is refused with setting-value-own-pattern, changing nothing", async () => {
    const store = await openStore(await build(complete()));
    try {
      const error = await runCommand(store, CHANGE_SETTING_VALUES, {
        follower_id: 'EX-LEND-UC02', pattern_id: 'EX-PAT-ACT', setting_values: [{ setting: 'record', value: 'Tool' }, { setting: 'record', value: 'Loan' }],
      }).then(() => null, (e: unknown) => e);
      expect(error).toBeInstanceOf(StoreError);
      expect((error as StoreError).problems.map((p) => [p.rule, p.message])).toEqual([
        ['setting-value-own-pattern', 'EX-LEND-UC02 gives setting record of EX-PAT-ACT a second value: a setting takes one value from each follower'],
      ]);
      expect(store.rows('setting_value')).toEqual([{ follower_id: 'EX-LEND-UC02', pattern_id: 'EX-PAT-ACT', setting: 'record', value: 'Tool' }]);
    } finally {
      await store.close();
    }
  });

  it('LA-TRC-UC07-R03-T01 a follower of two patterns with a setting of the same name gives each its own value', async () => {
    const data = adding(complete(), {
      pattern: [{ id: 'EX-PAT-AUD', title: 'Audited action', product_id: 'EX', description: 'An action the audit log records.' }],
      pattern_setting: [{ pattern_id: 'EX-PAT-AUD', position: 1, name: 'record', meaning: 'The record audited.' }],
      pattern_rule: [{ id: 'EX-PAT-AUD-R01', title: 'Each change is audited', pattern_id: 'EX-PAT-AUD', statement: 'Each change MUST be audited.' }],
      follows: [{ source_id: 'EX-LEND-UC02', target_id: 'EX-PAT-AUD' }],
    });
    // EX-LEND-UC02's value of record answers EX-PAT-ACT alone.
    expect(ofCheck(await loadData(data), 'pattern-setting-missing')).toEqual([
      expect.objectContaining({ severity: 'error', record: 'EX-LEND-UC02', message: expect.stringContaining('follows pattern EX-PAT-AUD') }),
    ]);
    const answered = adding(data, { setting_value: [{ follower_id: 'EX-LEND-UC02', pattern_id: 'EX-PAT-AUD', setting: 'record', value: 'Tool' }] });
    expect(ofCheck(await loadData(answered), 'pattern-setting-missing')).toEqual([]);
  });

  it('LA-TRC-UC07-R07-T01 a use case that follows a pattern is not asked for requirements of its own', async () => {
    const ws = await loadData(adding(shop(), sale('EX-SHOP-UC01', 'Sale')));
    const gapsOf = (id: string) => ws.coverage.flatMap((c) => c.gaps).filter((g) => g.id === id).map((g) => g.missing);
    expect(gapsOf('EX-SHOP-UC01')).not.toContain('use-case-without-requirement');
    expect(gapsOf('EX-SHOP-UC02')).toContain('use-case-without-requirement');
  });
});

describe('the other obligation kinds and their gaps', () => {
  it('LA-UCS-UC06-R15-T01 a use case with no flow is a use-case-without-flow gap in its domain, never an error', async () => {
    const data = adding(complete(), {
      use_case: [{ id: 'EX-LEND-UC03', title: 'Renew a loan', capability_id: 'EX-LEND-CAP01', goal: 'A member keeps a tool longer.' }],
      use_case_actor: [{ use_case_id: 'EX-LEND-UC03', position: 1, role_name: 'Member' }],
    });
    const ws = await loadData(data);
    expect(ws.coverage.find((c) => c.domain === 'EX-LEND')?.gaps.filter((g) => g.id === 'EX-LEND-UC03').map((g) => g.missing)).toContain('use-case-without-flow');
    expect(ws.problems.filter((p) => p.severity === 'error')).toEqual([]);
  });

  it("LA-TRC-UC07-R04-T01 a product kind declared an obligation is counted as Lathe's are, and one that is not is not counted", async () => {
    const data = adding(complete(), {
      product_kind: [
        { name: 'house_rule', product_id: 'EX', label: 'House rule', description: 'A rule of the house.', parent_kind: 'domain', stage: 'use-cases', obligation: true, complexity: 'essential' },
        { name: 'house_note', product_id: 'EX', label: 'House note', description: 'A note of the house.', parent_kind: 'domain', stage: 'use-cases', obligation: false, complexity: 'essential' },
      ],
      house_rule: [{ id: 'EX-LEND-HR01', title: 'Quiet', domain_id: 'EX-LEND' }],
      house_note: [{ id: 'EX-LEND-HN01', title: 'Tea at four', domain_id: 'EX-LEND' }],
    });
    const ws = await loadData(data);
    expect(obligation(ws, 'EX-LEND', 'house_rule')).toMatchObject({ total: 1, designed: 0, built: 0, proved: 0 });
    expect(obligation(ws, 'EX-LEND', 'house_note')).toBeUndefined();
    expect(records(ofCheck(ws, 'not-proved'))).toEqual(['EX-LEND-HR01']);
  });
});

describe('the run by levels', () => {
  it('LA-TRC-DS02-T01 each test kind allows its own levels, and a pattern rule test or a standard rule test any', () => {
    expect(ALLOWED_LEVELS).toEqual({
      constraint_test: ['unit', 'integration'],
      invariant_test: ['unit', 'integration'],
      specification_test: ['unit', 'integration'],
      policy_test: ['integration', 'service', 'system', 'browser'],
      domain_service_test: ['unit'],
      storage_requirement_test: ['integration', 'service', 'system', 'browser'],
      use_case_test: ['service', 'system', 'browser'],
      view_test: ['unit', 'browser'],
      endpoint_test: ['service', 'system'],
      flow_test: ['system', 'browser'],
      journey_test: ['service', 'system', 'browser'],
      integration_test: ['integration', 'service', 'system'],
      pattern_rule_test: ['unit', 'integration', 'service', 'system', 'browser'],
      standard_rule_test: ['unit', 'integration', 'service', 'system', 'browser'],
    });
  });
});
