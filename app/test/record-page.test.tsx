import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../src/specs/Markdown';
import { factsOf } from '../src/specs/RecordText';
import { addRows, indexOf } from './fixtures/load';
import { modelWorkspace } from './fixtures/model';
import { main, openApp, openSideBar, sideBar } from './helpers';

// The record page's wiki card shows its text fields, its parts (fields with their types, a table's
// keys, a command's recorded exceptions), its Traceability, children and problems; the side bar's
// Details adds its facts: its data file and line, its parent, and its Traceability in brief.
const side = () => main().querySelector('aside.record-side') as HTMLElement;
const card = () => screen.getByRole('region', { name: 'Wiki card' });
/** A fact's value in the side bar's Details, by its name. */
const fact = (name: string) => within(side()).getByText(name, { selector: 'dt' }).closest('div')!.querySelector('dd')!;

/** The wiki card's section under this heading (the side bar has a Traceability and Problems of its own). */
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

/** The records the side bar's Traceability in brief links to, by ID. */
const briefLinks = () => [...within(side()).getByRole('heading', { name: /^Traceability/ }).closest('section')!.querySelectorAll('a')].map((a) => a.getAttribute('href'));

/** A table's body rows, each as its cells' text (a link's ID and title run together). */
const rows = (table: Element) => [...table.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('th, td')].map((c) => c.textContent?.replace(/\s+/g, ' ').trim()));

describe('record page', () => {
  it('LA-V92-R13-T01 The record page shows the ID, kind, title, text fields as Markdown, parent and children', async () => {
    openSideBar();
    await openApp('/DM-SHOP-UC01');
    expect(await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' })).toBeInTheDocument();
    expect(card().querySelector('.record-id')).toHaveTextContent('DM-SHOP-UC01');
    // The kind is a badge in its stage's color.
    const badge = card().querySelector('.wiki-panel-title .eyebrow .kind-badge')!;
    expect(badge).toHaveTextContent('Use case');
    expect(badge).toHaveClass('stage-use-cases');
    expect(within(card()).getByText('A shopper adds an item.').closest('.markdown')).not.toBeNull();
    // The side bar: its data file and line, and its parent.
    expect(fact('Data file')).toHaveTextContent('data/use_case.jsonl:2');
    expect(fact('Parent').querySelector('a')).toHaveAttribute('href', '/DM-SHOP-CAP01');

    // The children are the wiki's: its UC requirements, and its flow listed by interface.
    const children = within(card()).getByRole('heading', { name: /^UC requirements/ });
    expect(children).toHaveTextContent(/^UC requirements\s*2$/);
    const items = [...children.closest('section')!.querySelectorAll('a.row-link')];
    expect(items.map((a) => a.getAttribute('href'))).toEqual(['/DM-SHOP-UC01-R01', '/DM-SHOP-UC01-R02']);
    const flows = within(card()).getByRole('heading', { name: /^Flows by interface/ }).closest('section')!;
    expect([...flows.querySelectorAll('a.row-link')].map((a) => a.getAttribute('href'))).toEqual(['/DM-SHOP-UC01-FL01']);
    expect(within(side()).queryByRole('heading', { name: /^UC requirements|^Children/ })).toBeNull();

    // Markdown in a text field is rendered.
    await openApp('/DM');
    expect((await screen.findByText('component tests')).tagName).toBe('STRONG');
  });

  it('LA-V92-R14-T01 The record page shows links out and links in, grouped and named by their labels, each clickable', async () => {
    openSideBar();
    await openApp('/DM-SHOP-UC01-R01');
    await screen.findByRole('heading', { level: 1, name: 'The basket shows the new item' });
    // A UC requirement is designed, built and proved by what its chain holds.
    expect(traceGroups()).toEqual({
      'Designed by': ['/DM-SHOP-CMD01', '/DM-SHOP-UC01-FL01', '/DM-SHOP-UC01-FL01-S01', '/DM-V01'],
      'Built by': ['/DM-SHOP-CMD01-H'],
      'Proved by': ['/DM-SHOP-UC01-R01-T01'],
    });
    // In brief in the side bar, each a link.
    expect(briefLinks()).toEqual(expect.arrayContaining(['/DM-SHOP-UC01-FL01-S01', '/DM-SHOP-UC01-R01-T01']));

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
    expect(briefLinks()).toEqual(expect.arrayContaining(['/DM-SHOP-UC01-R01', '/DM-SHOP-CMD01', '/DM-V01']));
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

  it('LA-V92-R13-T01 A record\'s kind shows in its stage\'s color, and a kind with no owner says why it has no parent', async () => {
    openSideBar('details', ['graph']);
    await openApp('/DM-V01?stage=graph');
    await screen.findByRole('heading', { level: 1, name: 'Basket page' });
    expect(card().querySelector('.wiki-panel-title .eyebrow .kind-badge')).toHaveClass('stage-interaction-design');
    // Both domains' flow steps happen in the view, so the product shares it: its breadcrumb starts at the product, in no domain.
    expect(within(card().querySelector<HTMLElement>('.breadcrumb')!).getAllByRole('link')[0]).toHaveTextContent('Demo shop');
    expect(card().querySelector('.breadcrumb')).not.toHaveTextContent('Shopping');
    expect(sideBar()).toHaveTextContent('None: it has no owner. It is shared: two or more domains use it, or none.');
  });
});
