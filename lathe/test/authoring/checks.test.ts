// Lathe's checks of the Authoring domain, one at a time: each starts from the complete product, which gives no
// problem, and changes one thing to break the rule. LA-STD-CODE-R05: each of the domain's check rows is tested here.
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
  it("LA-STD-MODELING-R06-T02 a flow not titled as its use case's title, in or through, and its interface's title is a warning", async () => {
    expect(ofCheck(clean, 'flow-title-off-pattern')).toEqual([]);
    const titled = (title: string) => changing(complete(), 'flow', (r) => r.id === 'EX-LEND-UC01-FL01', { title });
    for (const title of ['Borrow a tool in the web app', 'borrow a tool through Web app', 'Borrow a tool in web app']) {
      expect(ofCheck(await loadData(titled(title)), 'flow-title-off-pattern'), title).toEqual([]);
    }
    const found = ofCheck(await loadData(titled('Borrow at the desk')), 'flow-title-off-pattern');
    expect(found).toEqual([
      expect.objectContaining({
        severity: 'warning',
        record: 'EX-LEND-UC01-FL01',
        message:
          'Flow EX-LEND-UC01-FL01 is titled "Borrow at the desk", but its use case EX-LEND-UC01 is "Borrow a tool" and its interface EX-IF01 is "Web app"; title it "Borrow a tool in the web app".',
      }),
    ]);
    // A renamed use case shows in its flows.
    const renamed = changing(complete(), 'use_case', (r) => r.id === 'EX-LEND-UC01', { title: 'Lend a tool' });
    expect(records(ofCheck(await loadData(renamed), 'flow-title-off-pattern'))).toEqual(['EX-LEND-UC01-FL01']);
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
      interface: [{ id: 'EX-IF02', title: 'Member portal', product_id: 'EX', kind: 'web app', description: 'The pages members use from home.' }],
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
