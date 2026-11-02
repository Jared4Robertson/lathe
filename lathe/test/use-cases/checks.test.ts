// Lathe's checks of the Use cases domain, one at a time: each starts from the complete product, which gives no
// problem, and changes one thing to break the rule. LA-PAT-AGGREGATE-TESTS-R04: each of the domain's check rows is tested here.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Workspace } from '../../src/index.ts';
import { adding, changing, complete, loadData, ofCheck, records, removeData, withJourney } from '../helpers.ts';

afterAll(removeData);

let clean: Workspace;
beforeAll(async () => {
  clean = await loadData(complete());
});

/** A check row's tests, under its name. */
const check = (name: string, body: () => void) => describe(name, body);

const withFlow = (title: string, actors: string[], steps: { title: string; path?: string; interface_id?: string; invokes?: string }[]) =>
  adding(complete(), {
    use_case: [{ id: 'EX-LEND-UC03', title, capability_id: 'EX-LEND-CAP01', goal: 'A member gets something done.' }],
    use_case_actor: actors.map((role_name, i) => ({ use_case_id: 'EX-LEND-UC03', position: i + 1, role_name })),
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
  it("LA-STD-MODELING-R06-T02 a flow not titled as its use case's title is a warning", async () => {
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
  const named = async (capabilities: string[], useCases: string[]) => {
    const data = adding(complete(), {
      interface: [{ id: 'EX-IF02', title: 'Member portal', product_id: 'EX', kind: 'web app', description: 'The pages members use from home.', public: false }],
      capability: capabilities.map((title, i) => ({ id: `EX-LEND-CAP${String(i + 2).padStart(2, '0')}`, title, domain_id: 'EX-LEND', position: i + 2, description: 'A part of lending.' })),
      use_case: useCases.map((title, i) => ({ id: `EX-LEND-UC${String(i + 3).padStart(2, '0')}`, title, capability_id: 'EX-LEND-CAP01', goal: 'A member gets something done.' })),
    });
    return ofCheck(await loadData(data), 'title-breaks-convention');
  };

  it('LA-STD-MODELING-R02-T01 a capability starting with The or an -ing word, naming an interface or holding a list is a warning; a noun phrase or a single -ing noun is not', async () => {
    expect(ofCheck(clean, 'title-breaks-convention')).toEqual([]);
    const found = await named(
      ['Invoice management', 'Billing', 'The catalog', 'Writing invoices', 'Web app', 'Tools, members and loans', 'String lending'],
      [],
    );
    expect(records(found)).toEqual(['EX-LEND-CAP04', 'EX-LEND-CAP05', 'EX-LEND-CAP06', 'EX-LEND-CAP07']);
    expect(found.every((p) => p.severity === 'warning')).toBe(true);
    expect(found.find((p) => p.record === 'EX-LEND-CAP05')?.message).toBe(
      'Capability EX-LEND-CAP05 is titled "Writing invoices", which starts with the -ing word "writing"; name a capability as a noun phrase for a lasting ability of the business, such as "Payment processing" or "Lending".',
    );
  });

  it("LA-STD-MODELING-R03-T01 a use case naming one of its product's interfaces or an interface word is a warning; one goal of verb and object, or a list (use-case-title-joins-goals's), is not", async () => {
    const found = await named([], [
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

  it('LA-STD-MODELING-R03-T02 a use case titled with a CRUD verb over a record or data is a warning', async () => {
    const found = await named([], ["Change a product's data", 'Edit a record', 'Update the data', "Change Lathe's schema with a migration"]);
    expect(records(found)).toEqual(['EX-LEND-UC03', 'EX-LEND-UC04', 'EX-LEND-UC05']);
    expect(found.every((p) => p.severity === 'warning')).toBe(true);
    expect(found.map((p) => /uses the CRUD verb "(\w+)" over a record or data/.exec(p.message)?.[1])).toEqual(['change', 'edit', 'update']);
  });

  it('LA-STD-MODELING-R03-T03 a journey naming an interface, holding a list or titled with a CRUD verb over a record is a warning, as a use case', async () => {
    const titled = (titles: string[]) =>
      adding(withJourney(), { journey: titles.map((title, i) => ({ id: `EX-JR${String(i + 2).padStart(2, '0')}`, title, product_id: 'EX', trigger: 'A member asks.', result: 'The member is answered.' })) });
    const found = ofCheck(await loadData(titled(['Lend a tool through the web app', 'Borrow, use and return a tool', 'Update the loan data', 'Bring a new neighbor to their first loan'])), 'title-breaks-convention');
    expect(records(found)).toEqual(['EX-JR02', 'EX-JR03', 'EX-JR04']);
    expect(found[0].message).toBe(
      'Journey EX-JR02 is titled "Lend a tool through the web app", which names an interface or mechanism ("web app"); name a journey for the goal its steps reach together, verb first, such as "Get a damaged tool back in lending", and leave the interface to its use cases\' flows.',
    );
  });
});

/** The complete product with a third use case whose flow is given: the member's, offered through the web app. */

check('use-case-changes-many-aggregates', () => {
  it("LA-STD-MODELING-R15-T01 a use case whose actors' own steps change two aggregates is a warning; queries, refused paths and another actor's write are not counted", async () => {
    expect(ofCheck(clean, 'use-case-changes-many-aggregates')).toEqual([]);
    // Open a loan (Loan) and Add a tool (Tool): two aggregates through the member's own steps.
    const two = withFlow('Borrow a new tool', ['Member'], [
      { title: 'The member borrows a tool', invokes: 'EX-LEND-CMD01' },
      { title: 'The member adds a tool', invokes: 'EX-LEND-CMD02' },
    ]);
    expect(ofCheck(await loadData(two), 'use-case-changes-many-aggregates')).toEqual([
      {
        severity: 'warning', check: 'use-case-changes-many-aggregates', record: 'EX-LEND-UC03',
        message: "Use case EX-LEND-UC03 changes 2 aggregates through its actors' own steps (EX-LEND-A1 (Loan), EX-LEND-A2 (Tool)), but a use case changes at most one: split it by goal, make the later change a policy that hears the first's event, make another actor's write its trigger rather than a step, write a link from the record that owns it, or make the goals a journey.",
      },
    ]);
    // A query, a refused write and the librarian's write (not the use case's actor) change nothing of the member's.
    const one = withFlow('Borrow a tool again', ['Member'], [
      { title: 'The librarian adds a tool', invokes: 'EX-LEND-CMD02' },
      { title: 'The member borrows it', invokes: 'EX-LEND-CMD01' },
      { title: 'The member sees the loan', invokes: 'EX-LEND-QRY01' },
      { title: 'The member adds a tool, and is refused', path: 'Refused', invokes: 'EX-LEND-CMD02' },
    ]);
    expect(ofCheck(await loadData(one), 'use-case-changes-many-aggregates')).toEqual([]);
  });

  it("LA-STD-MODELING-R15-T02 aggregates are counted per interface that offers the use case: one interface's variant and another's change one each", async () => {
    const twoInterfaces = (data: ReturnType<typeof complete>) =>
      adding(data, {
        interface: [{ id: 'EX-IF02', title: 'Kiosk', product_id: 'EX', kind: 'web app', description: 'The self-service kiosk.', public: false }],
        offers: [{ source_id: 'EX-IF02', target_id: 'EX-LEND-UC03' }],
      });
    const variants = twoInterfaces(withFlow('Borrow a tool at the desk', ['Member'], [
      { title: 'The member borrows a tool', interface_id: 'EX-IF01', invokes: 'EX-LEND-CMD01' },
      { title: 'The member adds a tool', interface_id: 'EX-IF02', invokes: 'EX-LEND-CMD02' },
    ]));
    expect(ofCheck(await loadData(variants), 'use-case-changes-many-aggregates')).toEqual([]);
    const shared = twoInterfaces(withFlow('Borrow a tool at the desk', ['Member'], [
      { title: 'The member borrows a tool', invokes: 'EX-LEND-CMD01' },
      { title: 'The member adds a tool', interface_id: 'EX-IF02', invokes: 'EX-LEND-CMD02' },
    ]));
    expect(records(ofCheck(await loadData(shared), 'use-case-changes-many-aggregates'))).toEqual(['EX-LEND-UC03']);
  });
});

check('use-case-title-joins-goals', () => {
  it('LA-STD-MODELING-R15-T03 a use case titled with "and", "or" or a list is a warning; parts named after "with" are not', async () => {
    const titled = (titles: string[]) =>
      adding(complete(), { use_case: titles.map((title, i) => ({ id: `EX-LEND-UC${String(i + 3).padStart(2, '0')}`, title, capability_id: 'EX-LEND-CAP01', goal: 'A member gets something done.' })) });
    const found = ofCheck(await loadData(titled([
      'Borrow and return a tool',
      'Renew or return a loan',
      'Read tools, members, loans',
      'Borrow a tool with its case and charger',
      'Return a tool',
      'Borrow a sander',
    ])), 'use-case-title-joins-goals');
    expect(records(found)).toEqual(['EX-LEND-UC03', 'EX-LEND-UC04', 'EX-LEND-UC05']);
    expect(found.every((p) => p.severity === 'warning')).toBe(true);
    expect(found.map((p) => p.message)).toEqual([
      'Use case EX-LEND-UC03 is titled "Borrow and return a tool", which joins two goals with "and"; a use case is one goal of one actor: split it into a use case per goal, or name the parts of one thing with "with", such as "Write a use case with its flow and tests".',
      'Use case EX-LEND-UC04 is titled "Renew or return a loan", which joins two goals with "or"; a use case is one goal of one actor: split it into a use case per goal, or name the parts of one thing with "with", such as "Write a use case with its flow and tests".',
      'Use case EX-LEND-UC05 is titled "Read tools, members, loans", which joins a list; a use case is one goal of one actor: split it into a use case per goal, or name the parts of one thing with "with", such as "Write a use case with its flow and tests".',
    ]);
  });
});

check('another-actor-writes-in-a-step', () => {
  it("LA-STD-MODELING-R15-T04 a step whose subject is a role that is not one of its use case's actors and that sends a command is a warning; a query, an actor's own step or a role as an object is not", async () => {
    const data = withFlow('Borrow a free tool', ['Member'], [
      { title: 'The librarian adds a tool', invokes: 'EX-LEND-CMD02' },
      { title: 'While the tool is new, a Librarian adds another', invokes: 'EX-LEND-CMD02' },
      { title: 'The librarian shows the free tools', invokes: 'EX-LEND-QRY01' },
      { title: 'The member borrows a tool from the librarian', invokes: 'EX-LEND-CMD01' },
    ]);
    expect(ofCheck(await loadData(data), 'another-actor-writes-in-a-step')).toEqual([
      {
        severity: 'warning', check: 'another-actor-writes-in-a-step', record: 'EX-LEND-UC03-FL-S01',
        message: "Flow step EX-LEND-UC03-FL-S01 has the Librarian send EX-LEND-CMD02, but the Librarian is not one of EX-LEND-UC03's actors: another actor's write starts a use case rather than being a step of it; start the flow where its actors take over, or make the write a use case of its own and string the two in a journey.",
      },
      expect.objectContaining({ record: 'EX-LEND-UC03-FL-S02' }),
    ]);
  });
});

check('step-order', () => {
  it('LA-UCS-UC06-R80-T01 a path whose positions skip a number is reported once, on the first step after the gap', async () => {
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

  it("LA-PRD-UC33-R03-T02 a journey path whose positions skip a number is reported once, on the first step after the gap, as a flow's is", async () => {
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
