import { ALL_QUERIES } from '../../lathe/src/commands';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { parseFormatPage } from '../src/format/reference';
import { findItems, rankItems } from '../src/shell/QuickOpen';
import { recordIndexOf } from './read-view';
import { workspace } from './fixtures/workspace';
import { checksPanel, facts, openApp } from './helpers';
// The Graph view needs a ResizeObserver in jsdom.
import './graph/setup';

// A format page opens in the wiki card over the stage (`?page=format/…`), the stage keeping its focus (LA-PAT-APP-UX-R20).
const card = () => screen.getByRole('region', { name: 'Wiki card' });
const fact = (box: HTMLElement, name: string) => within(box).getByText(name, { selector: 'dt' }).nextElementSibling?.textContent;
/** The card's section with this heading. */
function section(name: string | RegExp) {
  const heading = within(card()).getByRole('heading', { name });
  return heading.closest('section') as HTMLElement;
}
/** Opens a format page over the Demo shop's stage, and waits for its title in the card. */
async function openPage(page: string, title: string) {
  await openApp(`/DM?page=${page}`);
  expect(await within(await screen.findByRole('region', { name: 'Wiki card' })).findByRole('heading', { level: 2, name: title })).toBeInTheDocument();
}
/** The link that opens a format page over the Demo shop's stage. */
const over = (page: string, base = '/DM') => `${base}${base.includes('?') ? '&' : '?'}page=${page}`;

describe('format reference pages', () => {
  it('LA-V01-R01-T01 The format page says how records are kept, then shows the kinds by stage, the relations and the checks by severity, as clickable rows', async () => {
    await openPage('format', 'Record format');
    // It opens in the wiki card, the whole page, over the stage that keeps its focus.
    expect(card()).toHaveClass('is-expanded');
    expect(screen.getByRole('region', { name: 'Graph stage' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/DM');
    expect(section(/^Kinds\d/)).toHaveTextContent(String(Object.keys(workspace().schema.kinds).length));
    expect(section('How records are kept')).toHaveTextContent('Every table\'s rows are one file in the product\'s data folder');

    const kinds = section(/^Kinds\d/);
    // The six stages in order, then the kinds outside them.
    expect([...kinds.querySelectorAll(':scope > section > .spec-section-head h3')].map((h) => h.firstChild?.textContent)).toEqual([
      'Discovery', 'Domain model', 'Use cases', 'Interface design', 'Technical specification', 'Test plan', 'Outside the stages',
    ]);
    const useCases = within(kinds).getByRole('heading', { name: /^Use cases/ }).closest('section')!;
    const row = within(useCases).getByRole('link', { name: /use_case\s*Use case/ });
    expect(row).toHaveAttribute('href', over('format/kinds/use_case'));
    expect(row).toHaveClass('row-link');

    const relations = section(/^Relations\d/);
    expect(within(relations).getAllByText('Fulfills').length).toBeGreaterThan(0);

    const checks = section(/^Checks\d/);
    const errors = within(checks).getByRole('heading', { name: /^Errors/ }).closest('section')!;
    const warnings = within(checks).getByRole('heading', { name: /^Warnings/ }).closest('section')!;
    expect(within(errors).getByRole('link', { name: /test-file-missing/ })).toHaveAttribute('href', over('format/checks/test-file-missing'));
    expect(within(warnings).getByRole('link', { name: /not-proved/ })).toHaveAttribute('href', over('format/checks/not-proved'));
    expect(within(errors).queryByRole('link', { name: /not-proved/ })).toBeNull();
  });

  const proveLaV01R02T01 = async () => {
    await openPage('format/kinds/use_case', 'Use case');
    expect(within(card()).getByText(/^An actor's goal:/)).toBeInTheDocument();

    const where = section('Where it sits');
    expect(fact(where, 'Stage')).toMatch(/^Use cases/);
    expect(fact(where, 'Parent')).toBe('Exactly one, of the kind below.');
    expect(within(section(/^Allowed parents/)).getByRole('link', { name: /capability/ })).toHaveAttribute('href', over('format/kinds/capability'));

    const fields = document.getElementById('fields')!;
    // Each column of its table, with its type, whether it is required and its meaning.
    const goal = within(fields).getByText('goal').closest('tr')!;
    expect(goal).toHaveAttribute('id', 'field-goal');
    expect(goal).toHaveTextContent(/goaltextyes/);
    expect(within(fields).getByText('notes').closest('tr')).toHaveTextContent(/notestextno/);
    expect(within(fields).getByText('capability_id').closest('tr')).toHaveTextContent(/capability_idtextyes/);
    expect(fact(fields, 'ID')).toBe('<P>-<D>-UC<nn>, such as TL-LEND-UC01');
    expect(fact(fields, 'ID starts with')).toBe("Its domain's ID and a hyphen");
    expect(fact(fields, 'Obligation')).toMatch(/^Not an obligation/);

    // Links by their readable words, each naming the kind at the other end.
    const out = section(/^Links out/);
    expect(within(out).getByText('Follows')).toBeInTheDocument();
    expect(within(out).getByRole('link', { name: /pattern/ })).toHaveAttribute('href', over('format/kinds/pattern'));
    const into = section(/^Links in/);
    expect(within(into).getByText('Questions about this')).toBeInTheDocument();

    expect(within(section(/^Checks that concern it/)).getByText(/No check names this kind/)).toBeInTheDocument();

    const example = section('Example');
    // The first use case by ID in the current space.
    expect(within(example).getByRole('link', { name: /DM-PAY-UC01/ })).toHaveAttribute('href', '/DM-PAY-UC01');
    // Where its row is in its data file.
    expect(example).toHaveTextContent('on line 1 of use_case.jsonl');

    const records = section(/^Records/);
    expect(records).toHaveTextContent('2 use cases in Demo shop, under:');
    expect(within(records).getByRole('link', { name: /DM-SHOP-CAP01\s*Buying/ })).toHaveAttribute('href', '/DM-SHOP-CAP01');
    expect(within(records).getByRole('link', { name: /DM-PAY-CAP01\s*Paying/ })).toHaveAttribute('href', '/DM-PAY-CAP01');

    // A link back to the focus closes the page; the card shows the focus's own page again.
    await userEvent.click(within(card()).getByRole('link', { name: /Back to/ }));
    expect(window.location.search).toBe('');
    await waitFor(() => expect(card()).toHaveAttribute('data-page', 'DM'));

    // A kind with no owner says so, and a kind with two possible parents lists both.
    await openPage('format/kinds/view', 'View');
    expect(fact(section('Where it sits'), 'Parent')).toMatch(/^None: it has no owner/);
    await openPage('format/kinds/endpoint', 'Endpoint');
    expect(within(section(/^Allowed parents/)).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([over('format/kinds/command'), over('format/kinds/query')]);
  };
  it('LA-V01-R02-T01 A kind page shows where the kind sits, its columns, its links in and out by their labels, its checks, an example and its records', proveLaV01R02T01);
  it('LA-V02-R01-T01 A kind page shows where the kind sits, its columns, its links in and out by their labels, its checks, an example and its records', proveLaV01R02T01);

  it('LA-V03-R01-T01 A check page shows its severity, explanation and query, and its problems now as clickable rows', async () => {
    await openPage('format/checks/not-proved', 'not-proved');
    // The check's own page reads it through the Check aggregate's query (get-check).
    expect(await within(card()).findByText('Every obligation is proved by a test.')).toBeInTheDocument();
    expect(within(card()).getByText('Add a test under it.')).toBeInTheDocument();
    expect(section('Query').querySelector('pre')).toHaveTextContent(/^SELECT 'not-proved' AS "check"/);
    const problems = section(/^Problems now/);
    expect(problems).toHaveTextContent('Problems now2');
    const row = within(problems).getByRole('link', { name: 'DM-SHOP-INV01' });
    expect(row).toHaveClass('row-link');
    expect(row).toHaveAttribute('href', '/DM-SHOP-INV01');
    expect(fact(card(), 'From')).toBe("Lathe's checks");

    // An explanation reads as Markdown.
    await openPage('format/checks/not-designed', 'not-designed');
    expect((await within(card()).findByText('fulfills')).tagName).toBe('CODE');

    // A check that reports nothing says so; an unknown one says it is not in the format.
    await openApp('/DM?page=format/checks/event-not-by-outbox');
    expect(await screen.findByText('This check reports nothing now.')).toBeInTheDocument();
    await openApp('/DM?page=format/checks/no-such-check');
    expect(await screen.findByText(/The format has no check called/)).toBeInTheDocument();
    await openApp('/DM?page=format/kinds/no_such_kind');
    expect(await screen.findByText(/The format has no kind called/)).toBeInTheDocument();
  });

  const proveLaV92R71T01 = async () => {
    // A record's facts, in the wiki card's whole page on the Graph stage.
    await openApp('/DM-SHOP-EP01?stage=graph');
    await screen.findByRole('heading', { level: 1, name: 'POST /basket/items' });
    expect(within(facts()).getByRole('link', { name: 'Endpoint' })).toHaveAttribute('href', over('format/kinds/endpoint', '/DM-SHOP-EP01?stage=graph'));

    // A problem's code on a record page, a domain page and the Checks page.
    await openApp('/DM-SHOP-INV01');
    await screen.findByRole('heading', { level: 1, name: 'A basket holds at most 50 items' });
    expect(within(section(/^Problems/)).getByRole('link', { name: 'not-proved' })).toHaveAttribute('href', over('format/checks/not-proved', '/DM-SHOP-INV01'));
    await openApp('/DM-SHOP');
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    expect(within(section(/^Problems in this domain/)).getByRole('link', { name: 'test-file-missing' })).toHaveAttribute('href', over('format/checks/test-file-missing', '/DM-SHOP'));
    await openApp('/DM?panel=checks');
    await waitFor(() => expect(checksPanel()).toBeInTheDocument());
    expect(within(checksPanel()).getByRole('link', { name: 'test-file-missing' })).toHaveAttribute('href', '/DM?panel=checks&page=format/checks/test-file-missing');

    // A group's kind leads to the kind's page too.
    await openApp('/DM-SHOP/interface-design/view');
    await screen.findByRole('heading', { level: 1, name: /^Views/ });
    expect(within(card()).getByRole('link', { name: 'View' })).toHaveAttribute('href', over('format/kinds/view', '/DM-SHOP/interface-design/view'));
  };
  it('LA-PAT-RECORD-PAGE-R18-T01 LA-PAT-RECORD-PAGE-R18-T02 LA-PAT-RECORD-PAGE-R18-T03 LA-PAT-RECORD-PAGE-R18-T04 LA-PAT-RECORD-PAGE-R18-T05 LA-PAT-RECORD-PAGE-R18-T06 The wiki card\'s kind and each problem code link to their format pages', proveLaV92R71T01);
  it('LA-V41-R02-T01 Each problem code links to its check\'s page', proveLaV92R71T01);

  it('LA-V65-R71-T01 The record format is a palette command and a link in the shortcuts sheet, not a nav footer link', async () => {
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    expect(within(screen.getByRole('navigation', { name: 'Main' })).queryByRole('link', { name: 'Record format' })).toBeNull();

    fireEvent.keyDown(document.body, { key: '?', code: 'Slash', shiftKey: true });
    const sheet = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });
    fireEvent.click(within(sheet).getByRole('link', { name: 'Record format' }));
    expect(window.location.pathname + window.location.search).toBe('/DM?page=format');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.keyDown(document.body, { key: 'P', code: 'KeyP', ctrlKey: true, shiftKey: true });
    const palette = await screen.findByRole('dialog', { name: 'Command palette' });
    await userEvent.type(within(palette).getByRole('combobox'), 'record format');
    expect(within(palette).getAllByRole('option').map((o) => o.querySelector('.palette-title')?.textContent)).toEqual(['Record format']);
  });

  it('LA-V64-R05-T01 Quick find finds kinds and checks by name and leads to their pages', async () => {
    const items = findItems(recordIndexOf(workspace()), ['event-not-by-outbox']);
    const kind = rankItems(items, 'Kind: Use case')[0];
    expect(kind).toMatchObject({ title: 'Kind: Use case', to: '?page=format/kinds/use_case' });
    expect(rankItems(items, 'event-not-by')[0]).toMatchObject({ title: 'Check: event-not-by-outbox', to: '?page=format/checks/event-not-by-outbox' });
    // A check that reports a problem now is found even before the reference loads.
    expect(rankItems(findItems(recordIndexOf(workspace()), []), 'not-proved')[0]).toMatchObject({ title: 'Check: not-proved' });

    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Go to…' }));
    const find = screen.getByRole('combobox', { name: 'Quick find' });
    await userEvent.type(find, 'Check: not-pro');
    await userEvent.keyboard('{Enter}');
    expect(window.location.pathname + window.location.search).toBe('/DM?page=format/checks/not-proved');
  });

  it('LA-V02-R02-T01 The pages are built from the loaded data: a check with no row in the check table is the engine\'s own, listed without an explanation', async () => {
    const { requests } = await openApp('/DM?page=format');
    await within(await screen.findByRole('region', { name: 'Wiki card' })).findByRole('heading', { level: 2, name: 'Record format' });
    // The specific reads: the Reference, the meta model and the space's own reads, each a query of its own.
    expect(requests).toEqual(expect.arrayContaining(['GET /api/reference', 'GET /api/meta-model/get-meta-model', 'GET /api/problems/list-problems?product_id=DM', 'GET /api/product/list-products']));
    expect(requests.filter((r) => r !== 'GET /api/reference').every((r) => ALL_QUERIES.some((q) => r.split('?')[0] === `${q.method} ${q.route}`))).toBe(true);
    expect(within(section(/^Checks\d/)).getByRole('link', { name: /^engine/ })).toHaveAttribute('href', over('format/checks/engine'));
    await openApp('/DM?page=format/checks/engine');
    expect(await screen.findByText(/The engine reports this itself/)).toBeInTheDocument();
    expect(fact(card(), 'From')).toBe('The engine itself');
    expect(within(section(/^Problems now/)).getByText('The checks could not read a file.')).toBeInTheDocument();
  });

  it('LA-V02-R02-T02 Format addresses parse to their pages', () => {
    expect(parseFormatPage('format')).toEqual({ page: 'format' });
    expect(parseFormatPage('format/kinds/use_case')).toEqual({ page: 'format-kind', kind: 'use_case' });
    expect(parseFormatPage('format/checks/too-many-children')).toEqual({ page: 'format-check', check: 'too-many-children' });
    expect(parseFormatPage('format/other')).toBeNull();
    expect(parseFormatPage(null)).toBeNull();
  });
});
