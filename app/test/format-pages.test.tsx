import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { parseSpecRoute } from '../src/specs/data';
import { findItems, rankItems } from '../src/shell/QuickFind';
import { indexOf } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { main, openApp, section } from './helpers';
// The Graph view, where the side bar's Details shows a record's facts, needs a ResizeObserver in jsdom.
import './graph/setup';

const sideBar = () => document.getElementById('side-bar') as HTMLElement;
const pane = () => main().querySelector('.pane') as HTMLElement;
const fact = (box: HTMLElement, name: string) => within(box).getByText(name, { selector: 'dt' }).nextElementSibling?.textContent;

describe('format reference pages', () => {
  it('LA-V01-R01-T01 The format page says how records are kept, then shows the kinds by stage, the relations and the checks by severity, as clickable rows', async () => {
    await openApp('/format');
    expect(await screen.findByRole('heading', { level: 1, name: 'Record format' })).toBeInTheDocument();
    // It opens in the workbench: one pane with the title in it, and the side bar beside it.
    expect(pane()).toContainElement(screen.getByRole('heading', { level: 1 }));
    expect(fact(sideBar(), 'Kinds')).toBe(String(Object.keys(workspace().schema.kinds).length));
    expect(section('How records are kept')).toHaveTextContent('Every table\'s rows are one file in data/');

    const kinds = section(/^Kinds\d/);
    // The five stages in order, then the kinds outside them.
    expect([...kinds.querySelectorAll(':scope > section > .spec-section-head h3')].map((h) => h.firstChild?.textContent)).toEqual([
      'Domain model', 'Use cases', 'Interaction design', 'Technical specification', 'Test plan', 'Outside the stages',
    ]);
    const useCases = within(kinds).getByRole('heading', { name: /^Use cases/ }).closest('section')!;
    const row = within(useCases).getByRole('link', { name: /use_case\s*Use case/ });
    expect(row).toHaveAttribute('href', '/format/kinds/use_case');
    expect(row).toHaveClass('row-link');

    const relations = section(/^Relations\d/);
    expect(within(relations).getAllByText('Fulfills').length).toBeGreaterThan(0);

    const checks = section(/^Checks\d/);
    const errors = within(checks).getByRole('heading', { name: /^Errors/ }).closest('section')!;
    const warnings = within(checks).getByRole('heading', { name: /^Warnings/ }).closest('section')!;
    expect(within(errors).getByRole('link', { name: /test-file-missing/ })).toHaveAttribute('href', '/format/checks/test-file-missing');
    expect(within(warnings).getByRole('link', { name: /not-proved/ })).toHaveAttribute('href', '/format/checks/not-proved');
    expect(within(errors).queryByRole('link', { name: /not-proved/ })).toBeNull();
  });

  const proveLaV01R02T01 = async () => {
    await openApp('/format/kinds/use_case');
    expect(await screen.findByRole('heading', { level: 1, name: 'Use case' })).toBeInTheDocument();
    expect(within(main()).getByText(/^An actor's goal:/)).toBeInTheDocument();

    const where = section('Where it sits');
    expect(fact(where, 'Stage')).toMatch(/^Use cases/);
    expect(fact(where, 'Parent')).toBe('Exactly one, of the kind below.');
    expect(within(section(/^Allowed parents/)).getByRole('link', { name: /capability/ })).toHaveAttribute('href', '/format/kinds/capability');

    const fields = document.getElementById('fields')!;
    // Each column of its table, with its type, whether it is required and its meaning.
    const goal = within(fields).getByText('goal').closest('tr')!;
    expect(goal).toHaveAttribute('id', 'field-goal');
    expect(goal).toHaveTextContent(/goaltextno/);
    expect(within(fields).getByText('capability_id').closest('tr')).toHaveTextContent(/capability_idtextyes/);
    expect(fact(fields, 'ID')).toBe('<P>-<D>-UC<nn>, such as TL-LEND-UC01');
    expect(fact(fields, 'ID starts with')).toBe("Its domain's ID and a hyphen");
    expect(fact(fields, 'Obligation')).toMatch(/^Not an obligation/);

    // Links by their readable words, each naming the kind at the other end.
    const out = section(/^Links out/);
    expect(within(out).getByText('Follows')).toBeInTheDocument();
    expect(within(out).getByRole('link', { name: /pattern/ })).toHaveAttribute('href', '/format/kinds/pattern');
    const into = section(/^Links in/);
    expect(within(into).getByText('Questions about this')).toBeInTheDocument();

    expect(within(section(/^Checks that concern it/)).getByText(/No check names this kind/)).toBeInTheDocument();

    const example = section('Example');
    // The first use case by ID in the current space.
    expect(within(example).getByRole('link', { name: /DM-PAY-UC01/ })).toHaveAttribute('href', '/DM-PAY-UC01');
    // Its row as its data file holds it.
    expect(example).toHaveTextContent('on line 1 of data/use_case.jsonl');
    expect(example.querySelector('pre')).toHaveTextContent('{"id":"DM-PAY-UC01","title":"Pay by card","capability_id":"DM-PAY-CAP01"}');

    const records = section(/^Records/);
    expect(records).toHaveTextContent('2 use cases in Demo shop, under:');
    expect(within(records).getByRole('link', { name: /DM-SHOP-CAP01\s*Buying/ })).toHaveAttribute('href', '/DM-SHOP-CAP01');
    expect(within(records).getByRole('link', { name: /DM-PAY-CAP01\s*Paying/ })).toHaveAttribute('href', '/DM-PAY-CAP01');

    // The side bar holds the kind's facts.
    expect(fact(sideBar(), 'Obligation')).toBe('None');
    expect(fact(sideBar(), 'Stage')).toBe('Use cases');
    expect(fact(sideBar(), 'Records')).toBe('2');
    expect(within(sideBar()).getByRole('link', { name: 'capability_id' })).toHaveAttribute('href', '#field-capability_id');

    // A kind with no owner says so, and a kind with two possible parents lists both.
    await openApp('/format/kinds/view');
    await screen.findByRole('heading', { level: 1, name: 'View' });
    expect(fact(section('Where it sits'), 'Parent')).toMatch(/^None: it has no owner/);
    await openApp('/format/kinds/endpoint');
    await screen.findByRole('heading', { level: 1, name: 'Endpoint' });
    expect(within(section(/^Allowed parents/)).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/format/kinds/command', '/format/kinds/query']);
  };
  it('LA-V01-R02-T01 A kind page shows where the kind sits, its columns, its links in and out by their labels, its checks, an example and its records', proveLaV01R02T01);
  it('LA-V02-R01-T01 A kind page shows where the kind sits, its columns, its links in and out by their labels, its checks, an example and its records', proveLaV01R02T01);

  it('LA-V03-R01-T01 A check page shows its severity, explanation and query, and its problems now as clickable rows', async () => {
    await openApp('/format/checks/not-proved');
    expect(await screen.findByRole('heading', { level: 1, name: 'not-proved' })).toBeInTheDocument();
    expect(within(main()).getByText('Every obligation is proved by a test.')).toBeInTheDocument();
    expect(within(main()).getByText('Add a test under it.')).toBeInTheDocument();
    expect(section('Query').querySelector('pre')).toHaveTextContent(/^SELECT 'warning' AS severity, 'not-proved'/);
    const problems = section(/^Problems now/);
    expect(problems).toHaveTextContent('Problems now2');
    const row = within(problems).getByRole('link', { name: 'DM-SHOP-INV01' });
    expect(row).toHaveClass('row-link');
    expect(row).toHaveAttribute('href', '/DM-SHOP-INV01');
    expect(fact(sideBar(), 'Problems')).toBe('2');
    expect(fact(sideBar(), 'From')).toBe("Lathe's checks");

    // An explanation reads as Markdown.
    await openApp('/format/checks/not-designed');
    await screen.findByRole('heading', { level: 1, name: 'not-designed' });
    expect(within(main()).getByText('fulfills').tagName).toBe('CODE');

    // A check that reports nothing says so; an unknown one says it is not in the format.
    await openApp('/format/checks/event-not-by-outbox');
    expect(await screen.findByText('This check reports nothing now.')).toBeInTheDocument();
    await openApp('/format/checks/no-such-check');
    expect(await screen.findByText(/The format has no check called/)).toBeInTheDocument();
    await openApp('/format/kinds/no_such_kind');
    expect(await screen.findByText(/The format has no kind called/)).toBeInTheDocument();
  });

  const proveLaV92R71T01 = async () => {
    // The side bar's Details, open in the Graph view (brief 64).
    await openApp('/DM-SHOP-EP01?view=wiki,graph');
    await screen.findByRole('heading', { level: 1, name: 'Add to basket' });
    expect(within(sideBar()).getByRole('link', { name: 'Endpoint' })).toHaveAttribute('href', '/format/kinds/endpoint');
    expect(within(sideBar()).getByRole('link', { name: 'method' })).toHaveAttribute('href', '/format/kinds/endpoint#field-method');

    // A problem's code on a record page, a domain page and the Checks page.
    await openApp('/DM-SHOP-INV01');
    await screen.findByRole('heading', { level: 1, name: 'A basket holds at most 50 items' });
    expect(within(sideBar()).getByRole('link', { name: 'not-proved' })).toHaveAttribute('href', '/format/checks/not-proved');
    await openApp('/DM-SHOP');
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    expect(within(section(/^Problems in this domain/)).getByRole('link', { name: 'test-file-missing' })).toHaveAttribute('href', '/format/checks/test-file-missing');
    await openApp('/DM/checks');
    await screen.findByRole('heading', { level: 1, name: 'Checks' });
    expect(within(main()).getByRole('link', { name: 'test-file-missing' })).toHaveAttribute('href', '/format/checks/test-file-missing');

    // A group's kind leads to the kind's page too.
    await openApp('/DM-SHOP/interaction-design/flow');
    await screen.findByRole('heading', { level: 1, name: /^Flows/ });
    expect(within(sideBar()).getByRole('link', { name: 'Flow' })).toHaveAttribute('href', '/format/kinds/flow');
  };
  it('LA-V92-R71-T01 The side bar\'s kind, each problem code and each column label link to their format pages', proveLaV92R71T01);
  it('LA-V41-R02-T01 Each problem code links to its check\'s page', proveLaV92R71T01);

  it('LA-V65-R71-T01 The record format is a palette command and a link in the shortcuts sheet, not a nav footer link', async () => {
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    expect(within(screen.getByRole('navigation', { name: 'Main' })).queryByRole('link', { name: 'Record format' })).toBeNull();

    fireEvent.keyDown(document.body, { key: '?', code: 'Slash', shiftKey: true });
    const sheet = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });
    fireEvent.click(within(sheet).getByRole('link', { name: 'Record format' }));
    expect(window.location.pathname).toBe('/format');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.keyDown(document.body, { key: 'P', code: 'KeyP', ctrlKey: true, shiftKey: true });
    const palette = await screen.findByRole('dialog', { name: 'Command palette' });
    await userEvent.type(within(palette).getByRole('combobox'), 'record format');
    expect(within(palette).getAllByRole('option').map((o) => o.querySelector('.palette-title')?.textContent)).toEqual(['Record format']);
  });

  it('LA-V90-R71-T01 Quick find finds kinds and checks by name and leads to their pages', async () => {
    const items = findItems(indexOf(workspace()), ['event-not-by-outbox']);
    const kind = rankItems(items, 'Kind: Use case')[0];
    expect(kind).toMatchObject({ title: 'Kind: Use case', to: '/format/kinds/use_case' });
    expect(rankItems(items, 'event-not-by')[0]).toMatchObject({ title: 'Check: event-not-by-outbox', to: '/format/checks/event-not-by-outbox' });
    // A check that reports a problem now is found even before the reference loads.
    expect(rankItems(findItems(indexOf(workspace()), []), 'not-proved')[0]).toMatchObject({ title: 'Check: not-proved' });

    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const find = screen.getAllByRole('combobox', { name: 'Quick find' })[0];
    await userEvent.type(find, 'Check: not-pro');
    await userEvent.keyboard('{Enter}');
    expect(window.location.pathname).toBe('/format/checks/not-proved');
  });

  it('LA-V02-R02-T01 The pages are built from the loaded data: a check with no row in the check table is the engine\'s own, listed without an explanation', async () => {
    const { requests } = await openApp('/format');
    await screen.findByRole('heading', { level: 1, name: 'Record format' });
    expect(requests).toEqual(['GET /api/spec']);
    expect(within(section(/^Checks\d/)).getByRole('link', { name: /^engine/ })).toHaveAttribute('href', '/format/checks/engine');
    await openApp('/format/checks/engine');
    expect(await screen.findByText(/The engine reports this itself/)).toBeInTheDocument();
    expect(fact(sideBar(), 'From')).toBe('The engine itself');
    expect(within(section(/^Problems now/)).getByText('The checks could not read a file.')).toBeInTheDocument();
  });

  it('LA-V02-R02-T02 Format addresses parse to their pages', () => {
    expect(parseSpecRoute('/format')).toEqual({ page: 'format' });
    expect(parseSpecRoute('/format/kinds/use_case')).toEqual({ page: 'format-kind', kind: 'use_case' });
    expect(parseSpecRoute('/format/checks/too-many-children')).toEqual({ page: 'format-check', check: 'too-many-children' });
    expect(parseSpecRoute('/format/other')).toEqual({ page: 'missing' });
  });
});
