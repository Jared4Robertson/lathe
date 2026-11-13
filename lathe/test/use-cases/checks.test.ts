// Lathe's checks of the Use cases domain, one at a time: each starts from the complete product, which gives no
// problem, and changes one thing to break the rule. LA-PAT-AGGREGATE-TESTS-R04: each of the domain's check rows is tested here.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { openStore, type Store, type Workspace } from '../../src/index.ts';
import { adding, build, changing, complete, loadData, ofCheck, records, refusedBy, removeData, run, withJourney, type Data } from '../helpers.ts';

afterAll(removeData);

let clean: Workspace;
beforeAll(async () => {
  clean = await loadData(complete());
});

/** A check row's tests, under its name. */
const check = (name: string, body: () => void) => describe(name, body);

/**
 * The complete product with a third use case whose flow is given, offered through the web app: its result, the member's
 * unless another first actor is given (the member already borrows a tool in EX-LEND-UC01).
 */
const withFlow = (title: string, actors: string[], steps: { title: string; path?: string; interface_id?: string; invokes?: string }[], result_id = 'EX-LEND-QRY01', first?: string) =>
  adding(complete(), {
    use_case: [{ id: 'EX-LEND-UC03', title, domain_id: 'EX-LEND', goal: 'A member gets something done.', result_id }],
    use_case_actor: [...(first ? [first] : []), ...actors].map((role_name, i) => ({ use_case_id: 'EX-LEND-UC03', position: i + 1, role_name })),
    uc_requirement: [{ id: 'EX-LEND-UC03-R01', title: 'It is done', use_case_id: 'EX-LEND-UC03', statement: 'The library MUST do it.' }],
    offers: [{ source_id: 'EX-IF01', target_id: 'EX-LEND-UC03' }],
    flow: [{ id: 'EX-LEND-UC03-FL', title, use_case_id: 'EX-LEND-UC03' }],
    flow_step: steps.map((s, i) => ({
      id: `EX-LEND-UC03-FL-S0${i + 1}`, title: s.title, flow_id: 'EX-LEND-UC03-FL', path: s.path ?? 'main',
      position: steps.slice(0, i).filter((o) => (o.path ?? 'main') === (s.path ?? 'main')).length + 1,
      ...(s.interface_id ? { interface_id: s.interface_id } : {}),
    })),
    fulfills: steps.map((_, i) => ({ source_id: `EX-LEND-UC03-FL-S0${i + 1}`, target_id: 'EX-LEND-UC03-R01' })),
    invokes: steps.flatMap((s, i) => (s.invokes ? [{ source_id: `EX-LEND-UC03-FL-S0${i + 1}`, target_id: s.invokes }] : [])),
  });

check('flow-title-off-pattern', () => {
  it("LA-STD-NAMING-R05-T02 a flow not titled as its use case's title is a warning", async () => {
    expect(ofCheck(clean, 'flow-title-off-pattern')).toEqual([]);
    const titled = (title: string) => changing(complete(), 'flow', (r) => r.id === 'EX-LEND-UC01-FL', { title });
    expect(ofCheck(await loadData(titled('  borrow A tool ')), 'flow-title-off-pattern')).toEqual([]);
    const found = ofCheck(await loadData(titled('Borrow a tool in the web app')), 'flow-title-off-pattern');
    expect(found).toEqual([
      expect.objectContaining({
        severity: 'warning',
        record: 'EX-LEND-UC01-FL',
        message: 'Flow EX-LEND-UC01-FL is titled "Borrow a tool in the web app", but its use case EX-LEND-UC01 is "Borrow a tool"; title it "Borrow a tool".',
      }),
    ]);
    // A renamed use case shows in its flow.
    const renamed = changing(complete(), 'use_case', (r) => r.id === 'EX-LEND-UC01', { title: 'Lend a tool' });
    expect(records(ofCheck(await loadData(renamed), 'flow-title-off-pattern'))).toEqual(['EX-LEND-UC01-FL']);
  });
});

check('title-breaks-convention', () => {
  const named = async (useCases: string[]) => {
    const data = adding(complete(), {
      interface: [{ id: 'EX-IF02', title: 'Member portal', product_id: 'EX', kind: 'web app', description: 'The pages members use from home.', public: false }],
      use_case: useCases.map((title, i) => ({ id: `EX-LEND-UC${String(i + 3).padStart(2, '0')}`, title, domain_id: 'EX-LEND', goal: 'A member gets something done.', result_id: 'EX-LEND-CMD01' })),
    });
    return ofCheck(await loadData(data), 'title-breaks-convention');
  };

  it("LA-STD-NAMING-R02-T01 a use case naming one of its product's interfaces or an interface word is a warning; verb and object, or a list, is not", async () => {
    expect(ofCheck(clean, 'title-breaks-convention')).toEqual([]);
    const found = await named([
      'Check the workspace from the command line',
      'Approve an invoice in the member portal',
      'Change a record on its page',
      'Read tools, members and loans',
      'Borrow a tool, or reserve one',
      'Return a tool and its case',
      'Refund a late fee',
      'Read the APIs',
      'Grant capital approval',
    ]);
    expect(records(found)).toEqual(['EX-LEND-UC03', 'EX-LEND-UC04', 'EX-LEND-UC05', 'EX-LEND-UC10']);
    expect(found.find((p) => p.record === 'EX-LEND-UC04')?.message).toBe(
      'Use case EX-LEND-UC04 is titled "Approve an invoice in the member portal", which names an interface or mechanism ("member portal"); name a use case for one goal of its actor, verb first, such as "Borrow a tool", and leave the interface to its flows.',
    );
  });

  it("LA-STD-NAMING-R02-T02 a use case titled with a CRUD verb over a record or data is not a warning: a command use case's verb is its command's", async () => {
    expect(await named(["Change a product's data", 'Edit a record', 'Update the data', 'Change a check'])).toEqual([]);
  });

  it('LA-STD-NAMING-R02-T03 a journey naming an interface, holding a list or titled with a CRUD verb over a record is a warning, as a use case', async () => {
    const titled = (titles: string[]) =>
      adding(withJourney(), { journey: titles.map((title, i) => ({ id: `EX-JR${String(i + 2).padStart(2, '0')}`, title, product_id: 'EX', trigger: 'A member asks.', result: 'The member is answered.' })) });
    const found = ofCheck(await loadData(titled(['Lend a tool through the web app', 'Borrow, use and return a tool', 'Update the loan data', 'Bring a new neighbor to their first loan'])), 'title-breaks-convention');
    expect(records(found)).toEqual(['EX-JR02', 'EX-JR03', 'EX-JR04']);
    expect(found[0].message).toBe(
      'Journey EX-JR02 is titled "Lend a tool through the web app", which names an interface or mechanism ("web app"); name a journey for the goal its steps reach together, verb first, such as "Get a damaged tool back in lending", and leave the interface to its use cases\' flows.',
    );
  });
});

/** A store over the data, closed after the test. */
const opened: Store[] = [];
afterEach(async () => {
  for (const store of opened.splice(0)) await store.close();
});
const storeOf = async (data: Data) => {
  const store = await openStore(await build(data), { latheDataDir: null });
  opened.push(store);
  return store;
};

/** A refusal's rules and messages. */
const refusals = async (store: Store, command: string, input: Record<string, unknown>) => (await refusedBy(store, command, input)).map((p) => [p.rule, p.message]);

/** A second query of the read model, for a query use case that asks two. */
const LIST_LOANS = { query: [{ id: 'EX-LEND-QRY02', title: 'List open loans', read_model_id: 'EX-LEND-RM01', description: 'The loans not yet returned.' }] };

check('use-case-invokes-another-command', () => {
  it("LA-STD-MODELING-R15-T01 a step that invokes a command other than its use case's result is an error on any path and whoever its subject is, and a write that adds one is refused; a query is not", async () => {
    expect(ofCheck(clean, 'use-case-invokes-another-command')).toEqual([]);
    const data = withFlow('Borrow a tool at the desk', ['Member'], [
      { title: 'The librarian adds a tool', invokes: 'EX-LEND-CMD02' },
      { title: 'The member borrows it', invokes: 'EX-LEND-CMD01' },
      { title: 'The member sees the free tools', invokes: 'EX-LEND-QRY01' },
      { title: 'The member adds a tool, and is refused', path: 'Refused', invokes: 'EX-LEND-CMD02' },
    ], 'EX-LEND-CMD01', 'Librarian');
    expect(ofCheck(await loadData(data), 'use-case-invokes-another-command')).toEqual([
      {
        severity: 'error', check: 'use-case-invokes-another-command', record: 'EX-LEND-UC03-FL-S01',
        message: "Flow step EX-LEND-UC03-FL-S01 of EX-LEND-UC03 invokes the command EX-LEND-CMD02 (Add a tool), but the use case's result is EX-LEND-CMD01: a use case invokes no command but its result; make EX-LEND-CMD02 its own use case, joined to this one in a journey, or the command of a policy.",
      },
      expect.objectContaining({ record: 'EX-LEND-UC03-FL-S04' }),
    ]);
    // A query use case invokes no command at all.
    const asking = withFlow('See the free tools', ['Member'], [
      { title: 'The member borrows a tool', invokes: 'EX-LEND-CMD01' },
      { title: 'The member sees the free tools', invokes: 'EX-LEND-QRY01' },
    ], 'EX-LEND-QRY01');
    expect(records(ofCheck(await loadData(asking), 'use-case-invokes-another-command'))).toEqual(['EX-LEND-UC03-FL-S01']);
    // A write that links a second command, or sets a result another command's step is left invoking, is refused.
    const store = await storeOf(complete());
    expect(await refusals(store, 'use-case change-flow-step', { id: 'EX-LEND-UC01-FL-S02', invokes: 'EX-LEND-CMD02' })).toEqual([
      ['use-case-invokes-another-command', "Flow step EX-LEND-UC01-FL-S02 of EX-LEND-UC01 would invoke the command EX-LEND-CMD02, but the use case's result is EX-LEND-CMD01: a use case invokes no command but its result; make EX-LEND-CMD02 its own use case, joined to this one in a journey, or the command of a policy."],
    ]);
    expect((await refusals(store, 'use-case change-use-case', { id: 'EX-LEND-UC01', result_id: 'EX-LEND-QRY01' })).map(([rule]) => rule)).toEqual(['use-case-invokes-another-command']);
  });
});

check('use-case-result-not-invoked', () => {
  it("LA-STD-MODELING-R15-T02 a use case whose main path, through an interface that offers it, never invokes its result is an error; another path's step does not count, and a use case with no flow is left to its gap", async () => {
    expect(ofCheck(clean, 'use-case-result-not-invoked')).toEqual([]);
    const unasked = withFlow('Borrow a tool at the desk', ['Member'], [
      { title: 'The member sees the free tools', invokes: 'EX-LEND-QRY01' },
      { title: 'The member borrows a tool', path: 'Late', invokes: 'EX-LEND-CMD01' },
    ], 'EX-LEND-CMD01', 'Librarian');
    expect(ofCheck(await loadData(unasked), 'use-case-result-not-invoked')).toEqual([
      {
        severity: 'error', check: 'use-case-result-not-invoked', record: 'EX-LEND-UC03',
        message: "Use case EX-LEND-UC03 has EX-LEND-CMD01 as its result, but no step of its main path through EX-IF01 invokes it: link the main-path step that invokes it, or make the use case's result what its main path invokes.",
      },
    ]);
    // Read per interface: the result invoked only in the web app's variant is not invoked through the kiosk.
    const variant = adding(withFlow('Borrow a tool at the desk', ['Member'], [
      { title: 'The member sees the free tools', invokes: 'EX-LEND-QRY01' },
      { title: 'The member borrows a tool', interface_id: 'EX-IF01', invokes: 'EX-LEND-CMD01' },
    ], 'EX-LEND-CMD01', 'Librarian'), {
      interface: [{ id: 'EX-IF02', title: 'Kiosk', product_id: 'EX', kind: 'web app', description: 'The self-service kiosk.', public: false }],
      interface_actor: [{ interface_id: 'EX-IF02', position: 1, role_name: 'Member' }],
      offers: [{ source_id: 'EX-IF02', target_id: 'EX-LEND-UC03' }],
    });
    expect(ofCheck(await loadData(variant), 'use-case-result-not-invoked').map((p) => p.message)).toEqual([
      expect.stringContaining('but no step of its main path through EX-IF02 invokes it'),
    ]);
    const flowless = adding(complete(), {
      use_case: [{ id: 'EX-LEND-UC03', title: 'Add a donated tool', domain_id: 'EX-LEND', goal: 'A member gives the library a tool.', result_id: 'EX-LEND-CMD02' }],
    });
    expect(ofCheck(await loadData(flowless), 'use-case-result-not-invoked')).toEqual([]);
  });
});

check('use-case-not-done', () => {
  it("LA-STD-MODELING-R15-T03 a query use case whose main path's last invoking step asks something other than its result is an error; a command use case may ask queries after its result", async () => {
    expect(ofCheck(clean, 'use-case-not-done')).toEqual([]);
    const trailing = adding(withFlow('See the free tools', ['Member'], [
      { title: 'The member sees the free tools', invokes: 'EX-LEND-QRY01' },
      { title: 'The member sees the open loans', invokes: 'EX-LEND-QRY02' },
    ], 'EX-LEND-QRY01'), LIST_LOANS);
    expect(ofCheck(await loadData(trailing), 'use-case-not-done')).toEqual([
      {
        severity: 'error', check: 'use-case-not-done', record: 'EX-LEND-UC03',
        message: 'Use case EX-LEND-UC03 asks its result EX-LEND-QRY01, but the last step of its main path that invokes anything through EX-IF01, EX-LEND-UC03-FL-S02, invokes EX-LEND-QRY02: a query use case is done when it asks its result; unlink the steps after it, make them a use case of their own, or make EX-LEND-QRY02 the result.',
      },
    ]);
    // The same steps with the second query as the result end where they should; a result never asked is result-not-invoked's.
    const done = changing(trailing, 'use_case', (r) => r.id === 'EX-LEND-UC03', { result_id: 'EX-LEND-QRY02' });
    expect(ofCheck(await loadData(done), 'use-case-not-done')).toEqual([]);
    const unasked = changing(trailing, 'invokes', (r) => r.target_id === 'EX-LEND-QRY01' && r.source_id === 'EX-LEND-UC03-FL-S01', { target_id: 'EX-LEND-QRY02' });
    expect(ofCheck(await loadData(unasked), 'use-case-not-done')).toEqual([]);
  });
});

check('use-case-identity-taken', () => {
  it('LA-STD-MODELING-R15-T04 two use cases of a product with the same first actor and result are an error on the later, and a write that makes them so is refused; another first actor is another use case', async () => {
    expect(ofCheck(clean, 'use-case-identity-taken')).toEqual([]);
    const twice = adding(complete(), {
      use_case: [
        { id: 'EX-LEND-UC03', title: 'Borrow a tool again', domain_id: 'EX-LEND', goal: 'A member takes another tool home.', result_id: 'EX-LEND-CMD01' },
        { id: 'EX-LEND-UC04', title: 'Borrow a tool for a member', domain_id: 'EX-LEND', goal: 'The librarian lends a tool at the desk.', result_id: 'EX-LEND-CMD01' },
      ],
      use_case_actor: [
        { use_case_id: 'EX-LEND-UC03', position: 1, role_name: 'Member' },
        { use_case_id: 'EX-LEND-UC04', position: 1, role_name: 'Librarian' },
        { use_case_id: 'EX-LEND-UC04', position: 2, role_name: 'Member' },
      ],
    });
    expect(ofCheck(await loadData(twice), 'use-case-identity-taken')).toEqual([
      {
        severity: 'error', check: 'use-case-identity-taken', record: 'EX-LEND-UC03',
        message: 'Use case EX-LEND-UC03 has the same first actor (Member) and result (EX-LEND-CMD01) as EX-LEND-UC01: no two use cases of a product share both; merge EX-LEND-UC03 into EX-LEND-UC01.',
      },
    ]);
    const store = await storeOf(complete());
    expect(await refusals(store, 'use-case add-use-case', { id: 'EX-LEND-UC03', title: 'Borrow a tool again', domain_id: 'EX-LEND', goal: 'A member takes another tool home.', result_id: 'EX-LEND-CMD01', actors: ['Member'] })).toEqual([
      ['use-case-identity-taken', 'Use case EX-LEND-UC03 would have the same first actor (Member) and result (EX-LEND-CMD01) as EX-LEND-UC01: no two use cases of a product share both; change EX-LEND-UC01 instead.'],
    ]);
    await run(store, 'use-case add-use-case', { id: 'EX-LEND-UC03', title: 'Borrow a tool for a member', domain_id: 'EX-LEND', goal: 'The librarian lends a tool at the desk.', result_id: 'EX-LEND-CMD01', actors: ['Librarian', 'Member'] });
    expect((await refusals(store, 'use-case change-use-case', { id: 'EX-LEND-UC03', actors: ['Member', 'Librarian'] })).map(([rule]) => rule)).toEqual(['use-case-identity-taken']);
  });
});

/** A second domain of the product, with an aggregate its command changes and a read model its query asks. */
const SHOP = {
  domain: [{ id: 'EX-SHOP', title: 'Shop', product_id: 'EX', position: 2, subdomain_type: 'supporting', description: 'Selling spare parts.' }],
  aggregate: [{ id: 'EX-SHOP-A1', title: 'Sale', domain_id: 'EX-SHOP', identity: 'Sale ID', description: 'One part sold to one member.' }],
  entity: [{ id: 'EX-SHOP-EN01', title: 'Sale', aggregate_id: 'EX-SHOP-A1', role: 'root', description: 'The sale itself.' }],
  command: [{ id: 'EX-SHOP-CMD01', title: 'Sell a part', entity_id: 'EX-SHOP-EN01', description: 'Sells a spare part to a member.' }],
  read_model: [{ id: 'EX-SHOP-RM01', title: 'Parts for sale', domain_id: 'EX-SHOP', description: 'The spare parts on the shelf.' }],
  query: [{ id: 'EX-SHOP-QRY01', title: 'List parts for sale', read_model_id: 'EX-SHOP-RM01', description: 'The parts for sale, by name.' }],
};

check('use-case-result-in-domain', () => {
  it("LA-STD-MODELING-R20-T01 a use case in a domain other than its result's aggregate's or read model's is an error naming that domain; one in its result's domain is not", async () => {
    expect(ofCheck(clean, 'use-case-result-in-domain')).toEqual([]);
    const data = adding(complete(), {
      ...SHOP,
      use_case: [
        { id: 'EX-LEND-UC03', title: 'Sell a part', domain_id: 'EX-LEND', goal: 'A member buys a spare part.', result_id: 'EX-SHOP-CMD01' },
        { id: 'EX-LEND-UC04', title: 'See the parts for sale', domain_id: 'EX-LEND', goal: 'A member sees what parts are for sale.', result_id: 'EX-SHOP-QRY01' },
        { id: 'EX-SHOP-UC01', title: 'Sell a part at the desk', domain_id: 'EX-SHOP', goal: 'The clerk sells a spare part.', result_id: 'EX-SHOP-CMD01' },
      ],
    });
    expect(ofCheck(await loadData(data), 'use-case-result-in-domain')).toEqual([
      {
        severity: 'error', check: 'use-case-result-in-domain', record: 'EX-LEND-UC03',
        message: 'Use case EX-LEND-UC03 is in EX-LEND, but its result EX-SHOP-CMD01 is of EX-SHOP (its aggregate EX-SHOP-A1): move it to EX-SHOP with Move a use case, or give it a result of its own domain.',
      },
      {
        severity: 'error', check: 'use-case-result-in-domain', record: 'EX-LEND-UC04',
        message: 'Use case EX-LEND-UC04 is in EX-LEND, but its result EX-SHOP-QRY01 is of EX-SHOP (its read model EX-SHOP-RM01): move it to EX-SHOP with Move a use case, or give it a result of its own domain.',
      },
    ]);
  });
});

check('use-case-title-off-result', () => {
  it("LA-STD-MODELING-R15-T05 a command use case whose title does not start with its command's verb is a warning; a query use case is not read", async () => {
    expect(ofCheck(clean, 'use-case-title-off-result')).toEqual([]);
    const titled = (title: string, result_id = 'EX-LEND-CMD01') => changing(complete(), 'use_case', (r) => r.id === 'EX-LEND-UC01', { title, result_id });
    expect(ofCheck(await loadData(titled('  borrow A tool ')), 'use-case-title-off-result')).toEqual([]);
    expect(ofCheck(await loadData(titled('Lend a tool')), 'use-case-title-off-result')).toEqual([
      {
        severity: 'warning', check: 'use-case-title-off-result', record: 'EX-LEND-UC01',
        message: 'Use case EX-LEND-UC01 is titled "Lend a tool", but its result EX-LEND-CMD01 is "Borrow a tool": a command use case starts with its command\'s verb; start its title with "Borrow", or rename the command.',
      },
    ]);
    expect(ofCheck(await loadData(titled('See the free tools', 'EX-LEND-QRY01')), 'use-case-title-off-result')).toEqual([]);
  });
});

check('step-order', () => {
  it('LA-UCS-UC10-R03-T01 a path whose positions skip a number is reported once, on the first step after the gap', async () => {
    const data = adding(complete(), {
      flow_step: [
        { id: 'EX-LEND-UC01-FL-S03', title: 'Refused', flow_id: 'EX-LEND-UC01-FL', path: 'refused', position: 2 },
        { id: 'EX-LEND-UC01-FL-S04', title: 'Told why', flow_id: 'EX-LEND-UC01-FL', path: 'Refused', position: 3 },
      ],
    });
    expect(ofCheck(await loadData(data), 'step-order')).toEqual([
      {
        severity: 'error', check: 'step-order', record: 'EX-LEND-UC01-FL-S03',
        message: 'Flow step EX-LEND-UC01-FL-S03 has position 2 on path refused in flow EX-LEND-UC01-FL, but no step of that path has position 1; number the steps of a path 1, 2, 3 and so on, with no gaps.',
      },
    ]);
  });

  it("LA-PRD-UC43-R02-T02 a journey path whose positions skip a number is reported once, on the first step after the gap, as a flow's is", async () => {
    expect(ofCheck(await loadData(withJourney()), 'step-order')).toEqual([]);
    const data = changing(withJourney(), 'journey_step', (r) => r.id === 'EX-JR01-S03', { position: 5 });
    expect(ofCheck(await loadData(data), 'step-order')).toEqual([
      {
        severity: 'error', check: 'step-order', record: 'EX-JR01-S03',
        message: 'Journey step EX-JR01-S03 has position 5 in journey EX-JR01, but no step has position 3, 4; number the steps of a journey 1, 2, 3 and so on, with no gaps.',
      },
    ]);
  });
});
