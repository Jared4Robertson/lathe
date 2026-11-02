// Lathe's checks of the Domain modeling domain, one at a time: each starts from the complete product, which gives no
// problem, and changes one thing to break the rule. LA-PAT-AGGREGATE-TESTS-R04: each of the domain's check rows is tested here.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Workspace } from '../../src/index.ts';
import { adding, complete, gaps, loadData, ofCheck, records, removeData, without } from '../helpers.ts';

afterAll(removeData);

let clean: Workspace;
beforeAll(async () => {
  clean = await loadData(complete());
});

/** A check row's tests, under its name. */
const check = (name: string, body: () => void) => describe(name, body);

check('repository-persists-nothing', () => {
  it('LA-MOD-UC02-R06-T03 a repository that persists no aggregate is an error until its link is written, and its aggregate has no repository', async () => {
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
  it("LA-MOD-UC10-R80-T01 a child entity its root does not reach by has_one or has_many is a warning", async () => {
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
        { id: 'EX-WEB', title: 'Web app', product_id: 'EX', position: 2, subdomain_type: 'generic', description: 'Pages members see.' },
        { id: 'EX-DB', title: 'Records', product_id: 'EX', position: 3, subdomain_type: 'generic', description: 'Records the library keeps.' },
        { id: 'EX-SHOP', title: 'Shop', product_id: 'EX', position: 4, subdomain_type: 'generic', description: 'Served by its own server.' },
        { id: 'EX-TOUR', title: 'Guided tours', product_id: 'EX', position: 5, subdomain_type: 'generic', description: 'Tours of the workshop.' },
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
