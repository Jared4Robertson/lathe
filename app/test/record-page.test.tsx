import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../src/specs/Markdown';
import { modelWorkspace } from './fixtures/model';
import { main, openApp } from './helpers';
import { pageOf } from '../src/record/pages';
import { recordIndexOf } from './read-view';
import { productKindWorkspace } from './fixtures/product-kinds';
import { patternWorkspace } from './fixtures/patterns';

// The record page's wiki card shows its aggregate's page (its text, its parts such as fields with their types), its
// Traceability, children and problems; its whole page adds its facts after the body: its kind, its stage, its data
// file and line, and its links out and in.
const card = () => screen.getByRole('region', { name: 'Wiki card' });
const facts = () => within(card()).getByRole('complementary', { name: 'Facts' });
/** A fact's value in the wiki card's Facts, by its name. */
const fact = (name: string) => within(facts()).getByText(name, { selector: 'dt' }).closest('div')!.querySelector('dd')!;
/** The wiki card open on the whole page, for the session. */
const expanded = () => window.sessionStorage.setItem('lathe:place', JSON.stringify({ depth: 1, hiddenKinds: [], card: { open: true, expanded: true } }));

/** The wiki card's section under this heading. */
function section(name: string | RegExp) {
  const element = within(card()).getByRole('heading', { name }).closest('section');
  expect(element).not.toBeNull();
  return element as HTMLElement;
}

/** The Traceability groups of the wiki, as label -> linked record addresses. */
function traceGroups() {
  const trace = section(/^Traceability/);
  return Object.fromEntries([...trace.querySelectorAll('h3')].map((h) => [
    h.firstChild?.textContent,
    [...h.closest('section')!.querySelectorAll('a.row-link')].map((a) => a.getAttribute('href')),
  ]));
}

/** The records the Facts' Links out and Links in lead to. */
const factLinks = () => [...facts().querySelectorAll('a')].map((a) => a.getAttribute('href'));

/** A table's body rows, each as its cells' text (a link's ID and title run together). */
const rows = (table: Element) => [...table.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('th, td')].map((c) => c.textContent?.replace(/\s+/g, ' ').trim()));

describe('record page', () => {
  it('LA-V92-R77-T01 every one of Lathe\'s kinds has its aggregate\'s page, and a kind a product declares has the Extension record page', () => {
    const { meta } = recordIndexOf(productKindWorkspace(), 'DM');
    const lathe = meta.kindList.filter((k) => k.declared_by === null).map((k) => k.kind);
    expect(lathe.filter((kind) => pageOf(meta, kind) === undefined)).toEqual([]);
    expect(pageOf(meta, 'security_control')?.name).toBe('ExtensionRecordPage');
  });

  it('LA-PAT-RECORD-PAGE-R08-T01 LA-PAT-RECORD-PAGE-R08-T02 LA-PAT-RECORD-PAGE-R08-T03 LA-PAT-RECORD-PAGE-R08-T04 LA-PAT-RECORD-PAGE-R08-T05 LA-PAT-RECORD-PAGE-R08-T06 The record page shows the ID, kind, title, text fields as Markdown, parent and children', async () => {
    expanded();
    await openApp('/DM-SHOP-UC01');
    expect(await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' })).toBeInTheDocument();
    // The card's kind line reads as the box's: the kind and the ID; its stripe takes the box's stage color.
    expect(card().querySelector('.wiki-panel-kind')).toHaveTextContent('Use case · DM-SHOP-UC01');
    expect(card().style.getPropertyValue('--card-accent')).toBe('var(--g-use-cases)');
    expect(within(card()).getByText('A shopper adds an item.').closest('.markdown')).not.toBeNull();
    // The facts: its data file and line; its parent is the breadcrumb's last step.
    expect(fact('Data file')).toHaveTextContent('use_case.jsonl:2');
    expect([...card().querySelector('.breadcrumb')!.querySelectorAll('a')].at(-1)).toHaveAttribute('href', '/DM-SHOP/use-cases');

    // The children are the wiki's: its UC requirements, and its flow.
    const children = within(card()).getByRole('heading', { name: /^UC requirements/ });
    expect(children).toHaveTextContent(/^UC requirements\s*2$/);
    const items = [...children.closest('section')!.querySelectorAll('a.row-link')];
    expect(items.map((a) => a.getAttribute('href'))).toEqual(['/DM-SHOP-UC01-R01', '/DM-SHOP-UC01-R02']);
    const flows = within(card()).getByRole('heading', { name: /^Flow\s*1/ }).closest('section')!;
    expect([...flows.querySelectorAll('a.row-link')].map((a) => a.getAttribute('href'))).toEqual(['/DM-SHOP-UC01-FL', '/DM-IF01']);
    // The facts do not repeat the parent or the children.
    expect(within(facts()).queryByText('Parent', { selector: 'dt' })).toBeNull();
    expect(within(facts()).queryByRole('heading', { name: /^UC requirements|^Children/ })).toBeNull();

    // Markdown in a text field is rendered.
    await openApp('/DM');
    expect((await screen.findByText('component tests')).tagName).toBe('STRONG');
  });

  it('LA-PAT-RECORD-PAGE-R09-T01 LA-PAT-RECORD-PAGE-R09-T02 LA-PAT-RECORD-PAGE-R09-T03 LA-PAT-RECORD-PAGE-R09-T04 LA-PAT-RECORD-PAGE-R09-T05 LA-PAT-RECORD-PAGE-R09-T06 The record page shows links out and links in, grouped and named by their labels, each clickable', async () => {
    expanded();
    await openApp('/DM-SHOP-UC01-R01');
    await screen.findByRole('heading', { level: 1, name: 'The basket shows the new item' });
    // A UC requirement is designed, built and proved by what its chain holds (its trace, read on its own).
    await within(main()).findByRole('heading', { name: /^Traceability/ });
    expect(traceGroups()).toEqual({
      'Designed by': ['/DM-SHOP-CMD01', '/DM-SHOP-UC01-FL', '/DM-SHOP-UC01-FL-S01'],
      'Built by': ['/DM-SHOP-CMD01-H'],
      'Proved by': ['/DM-SHOP-UC01-R01-T01'] });
    // In the facts, each a link: the kind to its page in the format reference, the check that reports it serves no
    // outcome (the demo shop has none), and the step that links in.
    await within(facts()).findByText('Serves', { selector: 'dt' });
    expect(factLinks()).toEqual(['/DM-SHOP-UC01-R01?page=format/kinds/uc_requirement', '/DM-SHOP-UC01-R01?page=format/checks/serves-no-outcome', '/DM-SHOP-UC01-FL-S01']);
    expect(within(facts()).getByRole('heading', { name: 'Links in' })).toBeInTheDocument();

    // Follow it to the step, then see its links out by their labels.
    const user = userEvent.setup();
    await user.click(within(section(/^Traceability/)).getByRole('link', { name: /DM-SHOP-UC01-FL-S01/ }));
    expect(window.location.pathname).toBe('/DM-SHOP-UC01-FL-S01');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Shopper adds the item');
    await waitFor(() => expect(traceGroups()).toMatchObject({
      Fulfills: ['/DM-SHOP-UC01-R01'],
      Invokes: ['/DM-SHOP-CMD01'] }));
    expect(factLinks()).toEqual(expect.arrayContaining(['/DM-SHOP-UC01-R01', '/DM-SHOP-CMD01']));
  });

  it('LA-PAT-RECORD-PAGE-R09-T01 LA-PAT-RECORD-PAGE-R09-T02 LA-PAT-RECORD-PAGE-R09-T03 LA-PAT-RECORD-PAGE-R09-T04 LA-PAT-RECORD-PAGE-R09-T05 LA-PAT-RECORD-PAGE-R09-T06 A use case\'s frame lists every link its record summary holds both ways, and its Problems count matches its list', async () => {
    // A use case that follows a pattern (a link out), named by a step's flow (links in through its requirements are
    // its requirements' own), with a problem of its own: the frame agrees with the reads one by one.
    const data = patternWorkspace();
    data.problems.push({ severity: 'warning', check: 'lone-child', record: 'DM-SHOP-UC01', message: 'DM-SHOP-UC01 has a lone child.' });
    const index = recordIndexOf(data, 'DM');
    const out = index.outgoing.get('DM-SHOP-UC01') ?? [];
    const into = index.incoming.get('DM-SHOP-UC01') ?? [];
    expect(out.length).toBeGreaterThan(0);
    expanded();
    await openApp('/DM-SHOP-UC01', { data });
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    const linked = (heading: string) => {
      const list = within(facts()).getByRole('heading', { name: heading }).nextElementSibling as HTMLElement;
      return [...list.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    };
    await waitFor(() => expect(linked('Links out').sort()).toEqual(out.map((l) => `/${l.target}`).sort()));
    if (into.length > 0) expect(linked('Links in').sort()).toEqual(into.map((l) => `/${l.source}`).sort());
    else expect(within(facts()).getByText('Nothing links to this record.')).toBeInTheDocument();
    // The Problems section's count is its list's length, and both are the problems the read gives the record.
    const problems = section(/^Problems/);
    await waitFor(() => expect(within(problems).getAllByRole('listitem')).toHaveLength(index.problemsFor.get('DM-SHOP-UC01')!.length));
    expect(problems.querySelector('.section-count')).toHaveTextContent(String(index.problemsFor.get('DM-SHOP-UC01')!.length));
  });

  it('LA-PAT-RECORD-PAGE-R10-T01 LA-PAT-RECORD-PAGE-R10-T02 LA-PAT-RECORD-PAGE-R10-T03 LA-PAT-RECORD-PAGE-R10-T04 LA-PAT-RECORD-PAGE-R10-T05 LA-PAT-RECORD-PAGE-R10-T06 A record body is sanitized before it is shown', async () => {
    await openApp('/DM-SHOP-CMD01-H');
    await screen.findByRole('heading', { level: 1, name: 'addToBasket' });
    const body = main().querySelector('.markdown') as HTMLElement;
    expect(body).toHaveTextContent('Holds baskets.');
    expect(body.querySelector('script')).toBeNull();
    expect(body.querySelector('[onerror]')).toBeNull();
    expect(within(body).getByText('bad link')).not.toHaveAttribute('href', 'javascript:alert(1)');
    expect((window as { __pwned?: boolean }).__pwned).toBeUndefined();

    const html = renderMarkdown('<iframe src="https://example.com"></iframe><p onclick="x()">hi</p>');
    expect(html).not.toContain('iframe');
    expect(html).not.toContain('onclick');
    expect(html).toContain('<p>hi</p>');
  });

  it('LA-PAT-RECORD-PAGE-R11-T01 LA-PAT-RECORD-PAGE-R11-T02 LA-PAT-RECORD-PAGE-R11-T03 LA-PAT-RECORD-PAGE-R11-T04 LA-PAT-RECORD-PAGE-R11-T05 LA-PAT-RECORD-PAGE-R11-T06 The record page lists every problem about the record', async () => {
    await openApp('/DM-SHOP-UC01-R01-T01');
    await screen.findByRole('heading', { level: 1, name: 'Adding an item shows it' });
    const problems = within(section(/^Problems/)).getAllByRole('listitem');
    expect(problems).toHaveLength(1);
    expect(problems[0]).toHaveTextContent(/error.*Test DM-SHOP-UC01-R01-T01 is run by test\/basket.test.ts, which does not exist\..*test-file-missing/);
    expect(within(main()).getByText('1 error')).toBeInTheDocument();

    await openApp('/DM-SHOP-UC01');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    expect(within(section(/^Problems/)).getByText('No problems.')).toBeInTheDocument();
  });

  it('LA-PAT-RECORD-PAGE-R08-T01 LA-PAT-RECORD-PAGE-R08-T02 LA-PAT-RECORD-PAGE-R08-T03 LA-PAT-RECORD-PAGE-R08-T04 LA-PAT-RECORD-PAGE-R08-T05 LA-PAT-RECORD-PAGE-R08-T06 A record\'s fields show their types: a basic type, a value object as a link, a reference to an aggregate with an arrow', async () => {
    await openApp('/P-D-EN03', { data: modelWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Loan' });
    const table = section(/^Fields/).querySelector('table')!;
    expect(rows(table)).toEqual([
      ['Loan ID', 'The loan\'s number.', 'whole number', 'yes', 'id', ''],
      ['Thing', 'What was lent.', '→ P-D-A1Thing', 'yes', 'thing_id', ''],
      ['Member', 'Who borrowed it.', '→ P-D-A2Member', 'yes', 'member_id', ''],
      ['Due date', 'When it is due back.', 'date', 'yes', '', '2026-03-16'],
    ]);
    expect(within(table).getByRole('link', { name: /P-D-A2/ })).toHaveAttribute('href', '/P-D-A2');

    // A value object's link, and an optional field.
    await openApp('/P-D-EN02', { data: modelWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Member' });
    const member = section(/^Fields/).querySelector('table')!;
    expect(within(member).getByRole('link', { name: /P-VO01/ })).toHaveAttribute('href', '/P-VO01');
    expect(rows(member)[2]).toEqual(['Account', 'The member\'s account.', '→ P-E-A1Account', 'no', '']);
  });




  it('LA-PAT-RECORD-PAGE-R08-T01 LA-PAT-RECORD-PAGE-R08-T02 LA-PAT-RECORD-PAGE-R08-T03 LA-PAT-RECORD-PAGE-R08-T04 LA-PAT-RECORD-PAGE-R08-T05 LA-PAT-RECORD-PAGE-R08-T06 A record\'s kind shows in its stage\'s color, and a kind with no owner sits in its product, in no domain', async () => {
    await openApp('/DM-V01?stage=graph');
    await screen.findByRole('heading', { level: 1, name: 'Basket page' });
    expect(card().style.getPropertyValue('--card-accent')).toBe('var(--g-interface-design)');
    // Both domains' flow steps happen in the view, so the product shares it: its breadcrumb starts at the product, in no domain.
    expect(within(card().querySelector<HTMLElement>('.breadcrumb')!).getAllByRole('link')[0]).toHaveTextContent('Demo shop');
    expect(card().querySelector('.breadcrumb')).not.toHaveTextContent('Shopping');
  });
});
