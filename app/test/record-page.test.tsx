import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../src/specs/Markdown';
import { factsOf } from '../src/specs/RecordText';
import { addRows, indexOf } from './fixtures/load';
import { modelWorkspace } from './fixtures/model';
import { main, openApp } from './helpers';

// The record page's wiki card shows its text fields, its parts (fields with their types, a table's
// keys, a command's recorded exceptions), its Traceability, children and problems; its whole page
// adds its facts after the body: its kind, its fields, its data file and line, and its links out and in.
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
  it('LA-V92-R13-T01 The record page shows the ID, kind, title, text fields as Markdown, parent and children', async () => {
    expanded();
    await openApp('/DM-SHOP-UC01');
    expect(await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' })).toBeInTheDocument();
    // The card's kind line reads as the box's: the kind and the ID; its stripe takes the box's stage color.
    expect(card().querySelector('.wiki-panel-kind')).toHaveTextContent('Use case · DM-SHOP-UC01');
    expect(card().style.getPropertyValue('--card-accent')).toBe('var(--g-use-cases)');
    expect(within(card()).getByText('A shopper adds an item.').closest('.markdown')).not.toBeNull();
    // The facts: its data file and line; its parent is the breadcrumb's last step.
    expect(fact('Data file')).toHaveTextContent('data/use_case.jsonl:2');
    expect([...card().querySelector('.breadcrumb')!.querySelectorAll('a')].at(-1)).toHaveAttribute('href', '/DM-SHOP-CAP01');

    // The children are the wiki's: its UC requirements, and its flow listed by interface.
    const children = within(card()).getByRole('heading', { name: /^UC requirements/ });
    expect(children).toHaveTextContent(/^UC requirements\s*2$/);
    const items = [...children.closest('section')!.querySelectorAll('a.row-link')];
    expect(items.map((a) => a.getAttribute('href'))).toEqual(['/DM-SHOP-UC01-R01', '/DM-SHOP-UC01-R02']);
    const flows = within(card()).getByRole('heading', { name: /^Flows by interface/ }).closest('section')!;
    expect([...flows.querySelectorAll('a.row-link')].map((a) => a.getAttribute('href'))).toEqual(['/DM-SHOP-UC01-FL01']);
    // The facts do not repeat the parent or the children.
    expect(within(facts()).queryByText('Parent', { selector: 'dt' })).toBeNull();
    expect(within(facts()).queryByRole('heading', { name: /^UC requirements|^Children/ })).toBeNull();

    // Markdown in a text field is rendered.
    await openApp('/DM');
    expect((await screen.findByText('component tests')).tagName).toBe('STRONG');
  });

  it('LA-V92-R14-T01 The record page shows links out and links in, grouped and named by their labels, each clickable', async () => {
    expanded();
    await openApp('/DM-SHOP-UC01-R01');
    await screen.findByRole('heading', { level: 1, name: 'The basket shows the new item' });
    // A UC requirement is designed, built and proved by what its chain holds.
    expect(traceGroups()).toEqual({
      'Designed by': ['/DM-SHOP-CMD01', '/DM-SHOP-UC01-FL01', '/DM-SHOP-UC01-FL01-S01', '/DM-V01'],
      'Built by': ['/DM-SHOP-CMD01-H'],
      'Proved by': ['/DM-SHOP-UC01-R01-T01'],
    });
    // In the facts, each a link: the kind to its page in the format reference, and the step that links in.
    expect(factLinks()).toEqual(['/DM-SHOP-UC01-R01?page=format/kinds/uc_requirement', '/DM-SHOP-UC01-FL01-S01']);
    expect(within(facts()).getByRole('heading', { name: 'Links in' })).toBeInTheDocument();

    // Follow it to the step, then see its links out by their labels.
    const user = userEvent.setup();
    await user.click(within(section(/^Traceability/)).getByRole('link', { name: /DM-SHOP-UC01-FL01-S01/ }));
    expect(window.location.pathname).toBe('/DM-SHOP-UC01-FL01-S01');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Shopper adds the item');
    await waitFor(() => expect(traceGroups()).toMatchObject({
      Fulfills: ['/DM-SHOP-UC01-R01'],
      Invokes: ['/DM-SHOP-CMD01'],
      'Happens in': ['/DM-V01'],
    }));
    expect(factLinks()).toEqual(expect.arrayContaining(['/DM-SHOP-UC01-R01', '/DM-SHOP-CMD01', '/DM-V01']));
  });

  it('LA-V92-R15-T01 A record body is sanitized before it is shown', async () => {
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

  it('LA-V92-R16-T01 The record page lists every problem about the record', async () => {
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

  it('LA-V92-R13-T01 A record\'s fields show their types: a basic type, a value object as a link, a reference to an aggregate with an arrow', async () => {
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

  it('LA-V92-R13-T01 A table shows its keys: the primary key, a unique key with the invariant it enforces and its condition, a foreign key with its target', async () => {
    await openApp('/P-D-EN03-TB', { data: modelWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'loans' });
    const keys = section(/^Keys/);
    expect(keys.querySelector('h2, h3')).toHaveTextContent(/^Keys\s*3$/);
    expect(rows(keys.querySelector('table')!)).toEqual([
      ['unnamed', 'primary', 'id', ''],
      ['loans_one_open_per_thing', 'unique', 'thing_id', 'enforces P-D-INV01A thing is lent to one member at a timewhere returned_at IS NULL'],
      ['unnamed', 'foreign', 'member_id', 'references P-D-EN02-TBmembers'],
    ]);
  });

  it('LA-V92-R13-T01 A technical record shows the packages it uses as one fact', () => {
    const index = indexOf(addRows(modelWorkspace(), 'package_use', { record_id: 'P-INT01-AD', package: 'nodemailer' }, { record_id: 'P-INT01-AD', package: '@scope/mjml' }));
    const facts = factsOf(index, index.byId.get('P-INT01-AD')!);
    expect(facts.filter((f) => f.column === null)).toEqual([{ column: null, label: 'packages', value: 'nodemailer, @scope/mjml' }]);
  });

  it('LA-V92-R13-T01 A command shows the other aggregates it also changes, each with its reason', async () => {
    await openApp('/P-D-CMD02', { data: modelWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Return thing' });
    const also = section(/^Also changes/);
    expect(within(also).getByRole('link', { name: /P-D-A1/ })).toHaveAttribute('href', '/P-D-A1');
    expect(also).toHaveTextContent('The thing must be lendable again in the same transaction as its return.');
    expect(also).toHaveTextContent(/recorded exception/);
  });

  it('LA-V92-R13-T01 A repository shows the other aggregates it also persists, each with its reason', async () => {
    await openApp('/P-D-REPO01', { data: modelWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'LoanRepository' });
    const also = section(/^Also persists/);
    expect(within(also).getByRole('link', { name: /P-D-A4/ })).toHaveAttribute('href', '/P-D-A4');
    expect(also).toHaveTextContent('Shelves are stored with the loans that take things off them.');
    expect(also).toHaveTextContent(/one repository per aggregate/);
  });

  it('LA-V92-R13-T01 A record\'s kind shows in its stage\'s color, and a kind with no owner sits in its product, in no domain', async () => {
    await openApp('/DM-V01?stage=graph');
    await screen.findByRole('heading', { level: 1, name: 'Basket page' });
    expect(card().style.getPropertyValue('--card-accent')).toBe('var(--g-interaction-design)');
    // Both domains' flow steps happen in the view, so the product shares it: its breadcrumb starts at the product, in no domain.
    expect(within(card().querySelector<HTMLElement>('.breadcrumb')!).getAllByRole('link')[0]).toHaveTextContent('Demo shop');
    expect(card().querySelector('.breadcrumb')).not.toHaveTextContent('Shopping');
  });
});
