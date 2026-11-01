// Lathe's checks of the Authoring domain, one at a time: each starts from the complete product, which gives no
// problem, and changes one thing to break the rule. LA-PAT-AGGREGATE-TESTS-R04: each of the domain's check rows is tested here.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Workspace } from '../../src/index.ts';
import { adding, changing, complete, gaps, loadData, ofCheck, records, removeData, without } from '../helpers.ts';

afterAll(removeData);

let clean: Workspace;
beforeAll(async () => {
  clean = await loadData(complete());
});

/** A check row's tests, under its name. */
const check = (name: string, body: () => void) => describe(name, body);

check('repository-persists-nothing', () => {
  it('LA-AUT-UC02-R06-T03 a repository that persists no aggregate is an error until its link is written, and its aggregate has no repository', async () => {
    expect(ofCheck(clean, 'repository-persists-nothing')).toEqual([]);
    const ws = await loadData(without(complete(), 'persists', (r) => r.source_id === 'EX-LEND-REPO02'));
    expect(ofCheck(ws, 'repository-persists-nothing')).toEqual([
      {
        severity: 'error',
        check: 'repository-persists-nothing',
        record: 'EX-LEND-REPO02',
        message: 'Repository EX-LEND-REPO02 persists no aggregate: link the aggregate it loads and saves with persists, or remove it.',
      },
    ]);
    expect(gaps(ws).filter((g) => g.startsWith('aggregate-without-repository'))).toEqual(['aggregate-without-repository EX-LEND-A2']);
  });
});

check('entity-unreferenced', () => {
  it("LA-AUT-UC10-R80-T01 a child entity its root does not reach by has_one or has_many is a warning", async () => {
    const ws = await loadData(without(complete(), 'has_one', () => true));
    expect(ofCheck(ws, 'entity-unreferenced')).toEqual([expect.objectContaining({ severity: 'warning', record: 'EX-LEND-EN02' })]);
  });
});

check('event-tense', () => {
  it('LA-STD-MODELING-R07-T02 a title with no past form as its last word or after its first is a warning', async () => {
    const data = adding(complete(), {
      domain_event: [
        { id: 'EX-LEND-EV03', title: 'Return tool', aggregate_id: 'EX-LEND-A1', published: false, description: 'A tool came back.' },
        { id: 'EX-LEND-EV04', title: 'Loan became overdue', aggregate_id: 'EX-LEND-A1', published: false, description: 'A loan passed its due date.' },
        { id: 'EX-LEND-EV05', title: 'Fee needed', aggregate_id: 'EX-LEND-A1', published: false, description: 'A fee became due.' },
        { id: 'EX-LEND-EV06', title: 'Speed', aggregate_id: 'EX-LEND-A1', published: false, description: 'A loan sped up.' },
      ],
    });
    expect(records(ofCheck(await loadData(data), 'event-tense'))).toEqual(['EX-LEND-EV03', 'EX-LEND-EV06']);
  });
});

check('domain-named-for-technology', () => {
  it('LA-STD-MODELING-R05-T02 a domain whose title or code names a technology is a warning; one only described so is not', async () => {
    const data = adding(complete(), {
      domain: [
        { id: 'EX-WEB', title: 'Web app', product_id: 'EX', subdomain_type: 'generic', description: 'Pages members see.' },
        { id: 'EX-DB', title: 'Records', product_id: 'EX', subdomain_type: 'generic', description: 'Records the library keeps.' },
        { id: 'EX-SHOP', title: 'Shop', product_id: 'EX', subdomain_type: 'generic', description: 'Served by its own server.' },
        { id: 'EX-TOUR', title: 'Guided tours', product_id: 'EX', subdomain_type: 'generic', description: 'Tours of the workshop.' },
      ],
    });
    const found = ofCheck(await loadData(data), 'domain-named-for-technology');
    expect(records(found)).toEqual(['EX-DB', 'EX-WEB']);
    expect(found.find((p) => p.record === 'EX-DB')?.message).toContain('its code DB says "db"');
  });
});

check('query-title-verb', () => {
  it('LA-STD-MODELING-R06-T01 a query not starting with Get, List or Find is a warning', async () => {
    expect(ofCheck(clean, 'query-title-verb')).toEqual([]);
    const data = adding(complete(), {
      query: [
        { id: 'EX-LEND-QRY02', title: 'Get a loan', read_model_id: 'EX-LEND-RM01', description: 'One loan by its number.' },
        { id: 'EX-LEND-QRY03', title: 'find a tool by name', read_model_id: 'EX-LEND-RM01', description: 'Tools whose name matches.' },
        { id: 'EX-LEND-QRY04', title: 'Show overdue loans', read_model_id: 'EX-LEND-RM01', description: 'Loans past their due date.' },
        { id: 'EX-LEND-QRY05', title: 'Getaway tools', read_model_id: 'EX-LEND-RM01', description: 'Tools away from the library.' },
      ],
    });
    const found = ofCheck(await loadData(data), 'query-title-verb');
    expect(records(found)).toEqual(['EX-LEND-QRY04', 'EX-LEND-QRY05']);
    expect(found.every((p) => p.severity === 'warning')).toBe(true);
    expect(found[0].message).toBe(
      'Query EX-LEND-QRY04 is titled "Show overdue loans", which does not start with Get, List or Find; title a query by what it returns, such as "List overdue loans".',
    );
  });
});

check('term-used-unlinked', () => {
  it("LA-STD-MODELING-R12-T01 a meaning that uses another term's title without a builds_on link is a warning", async () => {
    expect(ofCheck(clean, 'term-used-unlinked')).toEqual([]);
    const term = (id: string, title: string, meaning: string) => ({ id, title, domain_id: 'EX-LEND', meaning });
    const data = adding(complete(), {
      term: [
        term('EX-LEND-TM02', 'Tool', 'One item lent out.'),
        term('EX-LEND-TM03', 'Overdue loan', 'A loan past its due date.'),
        term('EX-LEND-TM04', 'Late fee', 'Money owed for an Overdue loan, counted in `loan` days, kept in a toolbox.'),
        term('EX-LEND-TM05', 'Active loan', 'A loan not yet returned.'),
        term('EX-LEND-TM06', 'Borrower', 'Someone holding tools.'),
        term('EX-LEND-TM07', 'Tool category', 'A group of tools of one kind.'),
        term('EX-LEND-TM08', 'Shelf', 'Where the tool categories sit.'),
      ],
      builds_on: [{ source_id: 'EX-LEND-TM05', target_id: 'EX-LEND-TM01' }],
    });
    const found = ofCheck(await loadData(data), 'term-used-unlinked');
    // Loan's own meaning (One tool lent…) uses Tool; Overdue loan uses Loan; Late fee uses Overdue loan, but not Loan
    // inside it, nor `loan` in code, nor tool inside toolbox; Active loan links Loan; Borrower uses Tools, plural; Tool
    // category uses Tools; Shelf uses Tool categories (a title ending in y, as -ies), but not Tool inside it.
    expect(found.map((p) => `${p.record} ${/uses "(.*?)"/.exec(p.message)?.[1]}`)).toEqual([
      'EX-LEND-TM01 Tool',
      'EX-LEND-TM03 Loan',
      'EX-LEND-TM04 Overdue loan',
      'EX-LEND-TM06 Tool',
      'EX-LEND-TM07 Tool',
      'EX-LEND-TM08 Tool category',
    ]);
    expect(found.every((p) => p.severity === 'warning')).toBe(true);
    expect(found[1].message).toBe('Term EX-LEND-TM03 (Overdue loan) uses "Loan" in its meaning but does not build on EX-LEND-TM01: link it with builds_on, or say it in plain words.');
  });
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

check('specification-title-article', () => {
  it('LA-STD-MODELING-R08-T01 a specification starting with A, An or The is a warning; a condition with no article is not', async () => {
    expect(ofCheck(clean, 'specification-title-article')).toEqual([]);
    const data = adding(complete(), {
      specification: [
        { id: 'EX-LEND-SP02', title: 'The tool is free', statement: 'A tool is free when no loan names it.' },
        { id: 'EX-LEND-SP03', title: 'an active member', statement: 'A member is active when they have borrowed this year.' },
        { id: 'EX-LEND-SP04', title: 'Theme is set', statement: 'A theme is set when one is chosen.' },
        { id: 'EX-LEND-SP05', title: 'Area is open', statement: 'An area is open when it has staff.' },
      ],
    });
    const found = ofCheck(await loadData(data), 'specification-title-article');
    expect(records(found)).toEqual(['EX-LEND-SP02', 'EX-LEND-SP03']);
    expect(found[0].message).toBe('Specification EX-LEND-SP02 is titled "The tool is free", which starts with "The"; name the condition with no article, such as "Tool is available".');
  });
});

check('test-title-not-a-result', () => {
  it('LA-STD-MODELING-R08-T02 a test titled "Tests that…" or "Should…" is a warning; a result, or the noun Tests first, is not', async () => {
    expect(ofCheck(clean, 'test-title-not-a-result')).toEqual([]);
    const titled = (titles: string[]) =>
      adding(complete(), {
        use_case_test: titles.map((title, i) => ({
          id: `EX-LEND-UC01-R01-T0${i + 2}`,
          title,
          uc_requirement_id: 'EX-LEND-UC01-R01',
          level: 'service',
          state: 'not automated yet',
          when: 'A member asks for a tool on loan.',
          then: 'The library refuses.',
        })),
      });
    const data = titled(['Tests that a lent tool is refused', 'Should refuse a lent tool', 'Test whether a tool is lent', 'Tests run one at a time', 'A lent tool is refused again']);
    const found = ofCheck(await loadData(data), 'test-title-not-a-result');
    expect(records(found)).toEqual(['EX-LEND-UC01-R01-T02', 'EX-LEND-UC01-R01-T03', 'EX-LEND-UC01-R01-T04']);
    expect(found[1].message).toBe(
      'Use case test EX-LEND-UC01-R01-T03 is titled "Should refuse a lent tool", which says what it tests or should do; title a test by the result it shows, such as "An overdue loan is refused a renewal".',
    );
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

  it("LA-STD-MODELING-R03-T01 a use case naming one of its product's interfaces, an interface word or a list is a warning; one goal of verb and object is not", async () => {
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
    expect(records(found)).toEqual(['EX-LEND-UC03', 'EX-LEND-UC04', 'EX-LEND-UC05', 'EX-LEND-UC06', 'EX-LEND-UC07', 'EX-LEND-UC10']);
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
});

check('step-order', () => {
  it('LA-AUT-UC06-R80-T01 a path whose positions skip a number is reported once, on the first step after the gap', async () => {
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
});

/** The complete product's one interface made another kind. */
const ofKind = (kind: string) => changing(complete(), 'interface', () => true, { kind });
/** The complete product with a second interface, a CLI that offers the first use case and has no command of its own. */
const withCli = () =>
  adding(complete(), {
    interface: [{ id: 'EX-IF02', title: 'CLI', product_id: 'EX', kind: 'CLI', description: 'The command line the librarian runs.', public: false }],
    offers: [{ source_id: 'EX-IF02', target_id: 'EX-LEND-UC01' }],
  });
const unreached = (step: string, operation: string, interface_: string, kind: string, wants: string) => ({
  severity: 'warning', check: 'step-unreached', record: step,
  message: `Flow step ${step} invokes ${operation}, but ${interface_}, an interface of kind ${kind} that offers its use case, has no ${wants}; add one, or make the step a variant of the interfaces that reach it.`,
});

check('step-unreached', () => {
  it('LA-AUT-UC06-R09-T02 an interface that offers a use case reaches what each of its steps invokes: a web app or desktop through a view that presents it, an API through an endpoint, a CLI or agent tools through a record of the product\'s own; else the step is reported', async () => {
    expect(ofCheck(clean, 'step-unreached')).toEqual([]);
    // A web app or desktop: a view presents the command or query.
    const bare = await loadData(without(complete(), 'presents', (l) => l.target_id === 'EX-LEND-QRY01'));
    expect(ofCheck(bare, 'step-unreached')).toEqual([unreached('EX-LEND-UC01-FL-S02', 'EX-LEND-QRY01', 'EX-IF01', 'web app', 'view that presents it')]);
    const desktop = await loadData(changing(without(complete(), 'presents', (l) => l.target_id === 'EX-LEND-CMD02'), 'interface', () => true, { kind: 'desktop' }));
    expect(ofCheck(desktop, 'step-unreached')).toEqual([unreached('EX-LEND-UC02-FL-S01', 'EX-LEND-CMD02', 'EX-IF01', 'desktop', 'view that presents it')]);
    // A view of another interface does not reach it.
    const elsewhere = await loadData(adding(complete(), { interface: [{ id: 'EX-IF02', title: 'Desk', product_id: 'EX', kind: 'desktop', description: 'The desk app.', public: false }] }));
    expect(ofCheck(elsewhere, 'step-unreached')).toEqual([]);
    const own = await loadData(changing(without(complete(), 'presents', (l) => l.target_id === 'EX-LEND-QRY01'), 'view', () => true, { interface_id: 'EX-IF01' }));
    expect(ofCheck(own, 'step-unreached').map((p) => p.record)).toEqual(['EX-LEND-UC01-FL-S02']);
    const theirs = await loadData(adding(changing(complete(), 'view', () => true, { interface_id: 'EX-IF02' }), { interface: [{ id: 'EX-IF02', title: 'Desk', product_id: 'EX', kind: 'desktop', description: 'The desk app.', public: false }] }));
    expect(ofCheck(theirs, 'step-unreached').map((p) => p.record)).toEqual(['EX-LEND-UC01-FL-S01', 'EX-LEND-UC01-FL-S02', 'EX-LEND-UC02-FL-S01']);
    // An API: an endpoint exposes it. Only the command has one.
    expect(ofCheck(await loadData(ofKind('API')), 'step-unreached')).toEqual([
      unreached('EX-LEND-UC01-FL-S02', 'EX-LEND-QRY01', 'EX-IF01', 'API', 'endpoint that exposes it'),
      unreached('EX-LEND-UC02-FL-S01', 'EX-LEND-CMD02', 'EX-IF01', 'API', 'endpoint that exposes it'),
    ]);
    // A CLI or agent tools: a record of the product's own interaction design kinds under it. None here.
    for (const kind of ['CLI', 'agent tools']) {
      expect(ofCheck(await loadData(ofKind(kind)), 'step-unreached').map((p) => p.record), kind).toEqual(['EX-LEND-UC01-FL-S01', 'EX-LEND-UC01-FL-S02', 'EX-LEND-UC02-FL-S01']);
    }
    // An interface of kind other reaches its operations in a way no record says.
    expect(ofCheck(await loadData(ofKind('other')), 'step-unreached')).toEqual([]);
    // Each interface that offers the use case is held to it, but a variant of another interface is not.
    expect(ofCheck(await loadData(withCli()), 'step-unreached').map((p) => [p.record, p.message.includes('EX-IF02')])).toEqual([['EX-LEND-UC01-FL-S01', true], ['EX-LEND-UC01-FL-S02', true]]);
    const variants = changing(withCli(), 'flow_step', (r) => String(r.id).startsWith('EX-LEND-UC01-FL-S'), { interface_id: 'EX-IF01' });
    expect(ofCheck(await loadData(variants), 'step-unreached')).toEqual([]);
  });
});

check('variant-not-offered', () => {
  it('LA-AUT-UC06-R09-T03 a step that is a variant of an interface that does not offer its use case is an error', async () => {
    expect(ofCheck(clean, 'variant-not-offered')).toEqual([]);
    const data = adding(complete(), { interface: [{ id: 'EX-IF02', title: 'CLI', product_id: 'EX', kind: 'other', description: 'The command line the librarian runs.', public: false }] });
    const variant = changing(data, 'flow_step', (r) => r.id === 'EX-LEND-UC01-FL-S01', { interface_id: 'EX-IF02' });
    expect(ofCheck(await loadData(variant), 'variant-not-offered')).toEqual([
      {
        severity: 'error', check: 'variant-not-offered', record: 'EX-LEND-UC01-FL-S01',
        message: 'Flow step EX-LEND-UC01-FL-S01 is a variant of EX-IF02, which does not offer its use case EX-LEND-UC01; offer it there, or name an interface that does.',
      },
    ]);
    const offered = adding(variant, { offers: [{ source_id: 'EX-IF02', target_id: 'EX-LEND-UC01' }] });
    expect(ofCheck(await loadData(offered), 'variant-not-offered')).toEqual([]);
  });
});

check('flow-not-offered', () => {
  it('LA-AUT-UC06-R09-T04 a use case with a flow that no interface offers is a warning', async () => {
    expect(ofCheck(clean, 'flow-not-offered')).toEqual([]);
    const ws = await loadData(without(complete(), 'offers', (l) => l.target_id === 'EX-LEND-UC02'));
    expect(ofCheck(ws, 'flow-not-offered')).toEqual([
      {
        severity: 'warning', check: 'flow-not-offered', record: 'EX-LEND-UC02',
        message: 'Use case EX-LEND-UC02 has a flow, EX-LEND-UC02-FL, but no interface offers it; offer it through the interfaces it happens through.',
      },
    ]);
  });
});

check('interface-actor-not-the-use-case', () => {
  it('LA-AUT-UC06-R09-T05 an interface that lists roles and offers a use case none of whose actors is among them is a warning', async () => {
    expect(ofCheck(clean, 'interface-actor-not-the-use-case')).toEqual([]);
    // The interface lists only the Librarian, but Borrow a tool is the Member's.
    const only = without(complete(), 'interface_actor', (r) => r.role_name === 'Member');
    expect(ofCheck(await loadData(only), 'interface-actor-not-the-use-case')).toEqual([
      {
        severity: 'warning', check: 'interface-actor-not-the-use-case', record: 'EX-IF01',
        message: "Interface EX-IF01 offers EX-LEND-UC01, but none of its roles (Librarian) is one of the use case's actors.",
      },
    ]);
    // An interface that lists no role is open to every actor.
    expect(ofCheck(await loadData(without(complete(), 'interface_actor', () => true)), 'interface-actor-not-the-use-case')).toEqual([]);
  });
});

check('outcome-target-undated', () => {
  it('LA-STD-MODELING-R13-T02 a business outcome whose target says no date is a warning; a year or a span from an event is a date', async () => {
    expect(ofCheck(clean, 'outcome-target-undated')).toEqual([]);
    const undated = await loadData(changing(complete(), 'business_outcome', () => true, { target: 'Two loans per tool per month.' }));
    expect(ofCheck(undated, 'outcome-target-undated')).toEqual([
      {
        severity: 'warning',
        check: 'outcome-target-undated',
        record: 'EX-BO01',
        message: 'Business outcome EX-BO01 gives its target with no date: say by when it is reached, such as within a year of opening or by 2027.',
      },
    ]);
    for (const target of ['Two loans per tool per month by 2027.', 'Two loans per tool per month, by the end of the first year.']) {
      expect(ofCheck(await loadData(changing(complete(), 'business_outcome', () => true, { target })), 'outcome-target-undated')).toEqual([]);
    }
  });
});

check('accidental-in-essential', () => {
  it("LA-STD-PRINCIPLES-R05-T02 An essential record that names technology its kind's group has no business with is a warning, by Lathe's words and the product's own", async () => {
    expect(ofCheck(clean, 'accidental-in-essential')).toEqual([]);
    // A use case's goal that clicks and a UC requirement that names the product's own interface are leaks.
    let data = changing(complete(), 'use_case', (r) => r.id === 'EX-LEND-UC01', { goal: 'A member clicks the borrow button.' });
    data = changing(data, 'uc_requirement', (r) => r.id === 'EX-LEND-UC01-R01', { statement: 'The Web app MUST refuse a tool whose row says it is on loan.' });
    // A flow step that clicks is a leak, and so is one that names an interface unless it is that interface's variant.
    data = changing(data, 'flow_step', (r) => r.id === 'EX-LEND-UC01-FL-S01', { title: 'Click Borrow on the tool' });
    data = adding(data, {
      flow_step: [
        { id: 'EX-LEND-UC01-FL-S03', title: 'Open the Web app', flow_id: 'EX-LEND-UC01-FL', path: 'extra', position: 1, interface_id: 'EX-IF01' },
        { id: 'EX-LEND-UC01-FL-S04', title: 'Open the Web app again', flow_id: 'EX-LEND-UC01-FL', path: 'extra', position: 2 },
      ],
    });
    // A view is a page with its buttons and rows; it still may not name the storage behind it.
    data = changing(data, 'view', () => true, { title: 'Catalog page', description: 'Every tool in a row with a Borrow button, read from the JSON the database keeps.' });
    // A pattern decides the means and a test drives an interface, so neither is read.
    data = changing(data, 'pattern_rule', () => true, { statement: 'A saved record MUST answer the same JSON over HTTP.' });
    data = changing(data, 'view_test', () => true, { when: 'Clicks the catalog page' });
    // A word that is a term of the record's own domain is its language: the library lends reading tables.
    data = adding(data, { term: [{ id: 'EX-LEND-TM02', title: 'Table', domain_id: 'EX-LEND', meaning: 'A reading table members borrow by the hour.' }] });
    data = changing(data, 'use_case', (r) => r.id === 'EX-LEND-UC02', { goal: 'The librarian adds a tool or a table to the catalog.' });
    data = changing(data, 'term', (r) => r.id === 'EX-LEND-TM01', { meaning: 'One tool lent to one member, kept in Postgres until it is returned.' });
    const ws = await loadData(data);
    expect(ofCheck(ws, 'accidental-in-essential').map((p) => [p.record, p.message.replace(/; say .*/, '').replace(/^.* names technology: /, '')])).toEqual([
      ['EX-LEND-UC01', 'its goal says "click"'],
      ['EX-LEND-UC01-FL-S01', 'its title says "click"'],
      ['EX-LEND-UC01-FL-S04', 'its title says "web app"'],
      ['EX-LEND-UC01-R01', 'its statement says "web app"'],
      ['EX-V01', 'its description says "json"'],
    ]);
    // The product's own technology words count in every group, and no term excuses them.
    const own = await loadData(adding(data, { product_setting: [{ product_id: 'EX', max_children: 15, max_entities_per_aggregate: 7, technology_words: ['Postgres', 'Table'] }] }));
    expect(records(ofCheck(own, 'accidental-in-essential'))).toEqual(['EX-LEND-TM01', 'EX-LEND-TM02', 'EX-LEND-UC01', 'EX-LEND-UC01-FL-S01', 'EX-LEND-UC01-FL-S04', 'EX-LEND-UC01-R01', 'EX-LEND-UC02', 'EX-V01']);
    expect(ofCheck(own, 'accidental-in-essential').find((p) => p.record === 'EX-LEND-TM01')?.message).toContain('its meaning says "postgres"');
  });
});

check('essential-restates-technical', () => {
  it('LA-STD-PRINCIPLES-R05-T03 An essential record that names the shape of a technical record, a table written as storage, a file or folder, a route or a command line, is a warning; words that only sound technical are not', async () => {
    expect(ofCheck(clean, 'essential-restates-technical')).toEqual([]);
    // Lathe's own requirements before they were converted (01c6a47e), over a product that keeps an entity_field table
    // in lathe/schema/ and routes its commands under /api/.
    let data = changing(complete(), 'table', (r) => r.id === 'EX-LEND-EN01-TB', { title: 'entity_field', name: 'entity_field', file: 'lathe/schema/004-domain-model.sql' });
    data = adding(data, {
      endpoint: [{ id: 'EX-LEND-EP02', title: 'POST /api/loans/open', command_id: 'EX-LEND-CMD02', method: 'POST', route: '/api/loans/open', description: 'Opens a loan.' }],
    });
    data = changing(data, 'uc_requirement', (r) => r.id === 'EX-LEND-UC01-R01', {
      statement: 'The engine MUST give each entity its entity_field rows as its fields, in position order, each with a name, a meaning, exactly one type, whether it is required, and a column name and example when they help.',
    });
    data = changing(data, 'uc_requirement', (r) => r.id === 'EX-LEND-UC02-R01', {
      statement: 'The CLI (lathe use-case <command>), the MCP tools (one per command and query) and HTTP (POST /api/use-case/<command>) MUST each name the one command they run.',
    });
    data = changing(data, 'use_case', (r) => r.id === 'EX-LEND-UC01', { goal: 'The merge driver MUST run as `lathe merge-data %O %A %B %P` for every file `.gitattributes` names with `merge=lathe-data`.' });
    data = changing(data, 'domain_service', () => true, { statement: 'Every kind MUST be defined by the numbered migrations in `lathe/schema/`; a loan is due after /api/loans/open answers.' });
    // Words that only sound technical, an interface's own mechanism and a view's route are not restatements.
    data = changing(data, 'use_case', (r) => r.id === 'EX-LEND-UC02', { goal: 'The librarian keeps the free_tools list and the `free tools` shelf, and/or the entity fields, in order.' });
    data = changing(data, 'interface', () => true, { description: 'The desk app, which calls POST /api/loans/open.' });
    data = changing(data, 'view', () => true, { description: 'Every tool, at /catalog/all.' });
    const ws = await loadData(data);
    expect(ofCheck(ws, 'essential-restates-technical').map((p) => [p.record, p.message.replace(/^.* names /, '').replace(/, the shape of .*$/, '')])).toEqual([
      ['EX-LEND-DS01', 'the file lathe/schema/, the route /api/loans/open'],
      ['EX-LEND-UC01', 'the command line lathe merge-data %O %A %B %P'],
      ['EX-LEND-UC01-R01', 'the table entity_field'],
      ['EX-LEND-UC02-R01', 'the route POST /api/use-case/<command>'],
    ]);
    // A table's name that is the title of one of the product's terms is its language.
    const termed = adding(data, { term: [{ id: 'EX-LEND-TM02', title: 'entity_field', domain_id: 'EX-LEND', meaning: 'A field of an entity, as the library lists them.' }] });
    expect(records(ofCheck(await loadData(termed), 'essential-restates-technical'))).toEqual(['EX-LEND-DS01', 'EX-LEND-UC01', 'EX-LEND-UC02-R01']);
  });
});
