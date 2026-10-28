import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../src/specs/Markdown';
import { modelWorkspace } from './fixtures/model';
import { main, openApp, openSideBar, section, sideBar } from './helpers';

// The record page's wiki shows its text fields, its parts (fields with their types, a table's keys,
// a command's recorded exceptions), its Traceability, children and problems; the side bar's Details,
// in the Wiki view, adds only what the page leaves out: the data file and line, the row's columns
// as stored and the raw links (brief 64).
const side = () => main().querySelector('aside.record-side') as HTMLElement;
/** A stored column's value in the side bar. */
const field = (name: string) => within(side()).getByText(name, { selector: 'dt code' }).closest('div')?.querySelector('dd')?.textContent;

/** The Traceability groups of the wiki, as label -> linked record addresses. */
function traceGroups() {
  const trace = section(/^Traceability/);
  return Object.fromEntries([...trace.querySelectorAll('h3')].map((h) => [
    h.firstChild?.textContent,
    [...h.closest('section')!.querySelectorAll('a.row-link')].map((a) => a.getAttribute('href')),
  ]));
}

/** The raw links in the side bar under "Links out" or "Links in", as "relation ID". */
const rawLinks = (heading: 'Links out' | 'Links in') => {
  const h = within(side()).getByRole('heading', { name: new RegExp(`^${heading}`) });
  return [...h.closest('section')!.querySelectorAll('li')].map((li) => li.textContent?.replace(/\s+/g, ' ').trim());
};

/** A table's body rows, each as its cells' text (a link's ID and title run together). */
const rows = (table: Element) => [...table.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('th, td')].map((c) => c.textContent?.replace(/\s+/g, ' ').trim()));

describe('record page', () => {
  it('LA-V92-R13-T01 The record page shows the ID, kind, title, text fields as Markdown, parent and children', async () => {
    openSideBar();
    await openApp('/DM-SHOP-UC01');
    expect(await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' })).toBeInTheDocument();
    expect(main().querySelector('.record-id')).toHaveTextContent('DM-SHOP-UC01');
    // The kind is a badge in its stage's color.
    const badge = main().querySelector('.pane-title .eyebrow .kind-badge')!;
    expect(badge).toHaveTextContent('Use case');
    expect(badge).toHaveClass('stage-use-cases');
    expect(within(main()).getByText('A shopper adds an item.').closest('.markdown')).not.toBeNull();
    // The side bar: the row's columns as stored, and its data file and line.
    expect(field('id')).toBe('"DM-SHOP-UC01"');
    expect(field('goal')).toBe('"A shopper adds an item."');
    expect(within(side()).getByText('data/use_case.jsonl:2')).toBeInTheDocument();
    expect(within(side()).getByText('capability_id', { selector: 'dt code' }).closest('div')!.querySelector('a')).toHaveAttribute('href', '/DM-SHOP-CAP01');

    // The children are the wiki's: its UC requirements and its flow.
    const children = within(main()).getByRole('heading', { name: /^Children/ });
    expect(children).toHaveTextContent(/^Children\s*3$/);
    const items = [...children.closest('section')!.querySelectorAll('a.row-link')];
    expect(items.map((a) => a.getAttribute('href'))).toEqual(expect.arrayContaining(['/DM-SHOP-UC01-R01', '/DM-SHOP-UC01-R02', '/DM-SHOP-UC01-FL']));
    expect(within(side()).queryByRole('heading', { name: /^Children/ })).toBeNull();

    // Markdown in a text field is rendered.
    await openApp('/DM');
    expect((await screen.findByText('component tests')).tagName).toBe('STRONG');
  });

  it('LA-V92-R14-T01 The record page shows links out and links in, grouped and named by their labels, each clickable', async () => {
    openSideBar();
    await openApp('/DM-SHOP-UC01-R01');
    await screen.findByRole('heading', { level: 1, name: 'The basket shows the new item' });
    // A UC requirement is designed by the steps that fulfill it and proved by its tests.
    expect(traceGroups()).toEqual({
      'Designed by': ['/DM-SHOP-UC01-FL-S01'],
      'Proved by': ['/DM-SHOP-UC01-R01-T01'],
    });
    // Raw in the side bar, as the link tables hold them.
    expect(within(side()).getByText('This record links to nothing.')).toBeInTheDocument();
    expect(rawLinks('Links in')).toEqual(['fulfills DM-SHOP-UC01-FL-S01']);

    // Follow it to the step, then see its links out by their labels.
    const user = userEvent.setup();
    await user.click(within(section(/^Traceability/)).getByRole('link', { name: /DM-SHOP-UC01-FL-S01/ }));
    expect(window.location.pathname).toBe('/DM-SHOP-UC01-FL-S01');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Shopper adds the item');
    expect(traceGroups()).toMatchObject({
      Fulfills: ['/DM-SHOP-UC01-R01'],
      Invokes: ['/DM-SHOP-CMD01'],
      'Happens in': ['/DM-V01'],
    });
    expect(rawLinks('Links out')).toEqual(expect.arrayContaining(['fulfills DM-SHOP-UC01-R01', 'invokes DM-SHOP-CMD01', 'happens_in DM-V01']));
    expect(within(side()).getByText('Nothing links to this record.')).toBeInTheDocument();
  });

  it('LA-V92-R15-T01 A record body is sanitized before it is shown', async () => {
    await openApp('/DM-SHOP-CMD01-H');
    await screen.findByRole('heading', { level: 1, name: 'Basket service' });
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
    await screen.findByRole('heading', { level: 1, name: 'Loans table' });
    const keys = section(/^Keys/);
    expect(keys.querySelector('h2, h3')).toHaveTextContent(/^Keys\s*3$/);
    expect(rows(keys.querySelector('table')!)).toEqual([
      ['unnamed', 'primary', 'id', ''],
      ['loans_one_open_per_thing', 'unique', 'thing_id', 'enforces P-D-INV01A thing is lent to one member at a timewhere returned_at IS NULL'],
      ['unnamed', 'foreign', 'member_id', 'references P-D-EN02-TBMembers table'],
    ]);
  });

  it('LA-V92-R13-T01 A command shows the other aggregates it also changes, each with its reason', async () => {
    await openApp('/P-D-CMD02', { data: modelWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Return thing' });
    const also = section(/^Also changes/);
    expect(within(also).getByRole('link', { name: /P-D-A1/ })).toHaveAttribute('href', '/P-D-A1');
    expect(also).toHaveTextContent('The thing must be lendable again in the same transaction as its return.');
    expect(also).toHaveTextContent(/recorded exception/);
  });

  it('LA-V92-R13-T01 A record\'s kind shows in its stage\'s color, and a kind with no owner says why it has no parent', async () => {
    openSideBar('details', ['graph']);
    await openApp('/DM-V01?view=graph');
    await screen.findByRole('heading', { level: 1, name: 'Basket page' });
    expect(document.querySelector('.pane-title .eyebrow .kind-badge')).toHaveClass('stage-interaction-design');
    // Both domains' flow steps happen in the view, so the product shares it: its eyebrow names the product only.
    expect(document.querySelector('.pane-title .eyebrow')).toHaveTextContent(/^Demo shop · View/);
    expect(sideBar()).toHaveTextContent('None: it has no owner. It is shared: two or more domains use it, or none.');
  });
});
