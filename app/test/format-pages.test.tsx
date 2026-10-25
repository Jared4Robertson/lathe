import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { parseSpecRoute } from '../src/specs/data';
import { findItems, rankItems } from '../src/shell/QuickFind';
import { indexWorkspace } from '../src/specs/data';
import { workspace } from './fixtures/workspace';
import { main, openApp, section } from './helpers';
// The Graph view, where the side bar's Details shows a record's facts, needs a ResizeObserver in jsdom.
import './graph/setup';

const sideBar = () => document.getElementById('side-bar') as HTMLElement;
const pane = () => main().querySelector('.pane') as HTMLElement;
const fact = (box: HTMLElement, name: string) => within(box).getByText(name, { selector: 'dt' }).nextElementSibling?.textContent;

describe('format reference pages', () => {
  it('LA-AUT-T110 The format page shows the concepts, then the kinds by stage and folder, the relations and the checks by severity, as clickable rows', async () => {
    await openApp('/format');
    expect(await screen.findByRole('heading', { level: 1, name: 'Record format' })).toBeInTheDocument();
    // It opens in the workbench: one pane with the title in it, and the side bar beside it.
    expect(pane()).toContainElement(screen.getByRole('heading', { level: 1 }));
    expect(fact(sideBar(), 'Kinds')).toBe(String(workspace().kinds.length));
    expect(screen.getByRole('heading', { name: '7. Fitness' })).toHaveAttribute('id', '7-fitness');

    const kinds = section(/^Kinds\d/);
    const define = within(kinds).getByRole('heading', { name: /^Define/ }).closest('section')!;
    const useCases = within(define).getByRole('heading', { name: /^Capabilities/ }).closest('section')!;
    const row = within(useCases).getByRole('link', { name: /use_case\s*Use case/ });
    expect(row).toHaveAttribute('href', '/format/kinds/use_case');
    expect(row).toHaveClass('row-link');

    const relations = section(/^Relations\d/);
    expect(within(relations).getAllByText('Satisfies').length).toBeGreaterThan(0);

    const checks = section(/^Checks\d/);
    const errors = within(checks).getByRole('heading', { name: /^Errors/ }).closest('section')!;
    const warnings = within(checks).getByRole('heading', { name: /^Warnings/ }).closest('section')!;
    expect(within(errors).getByRole('link', { name: /dangling-link/ })).toHaveAttribute('href', '/format/checks/dangling-link');
    expect(within(warnings).getByRole('link', { name: /unproved/ })).toHaveAttribute('href', '/format/checks/unproved');
    expect(within(errors).queryByRole('link', { name: /unproved/ })).toBeNull();
  });

  it('LA-AUT-T111 A kind page shows where the kind sits, its fields, its links in and out by their labels, its checks, an example and its records', async () => {
    await openApp('/format/kinds/use_case');
    expect(await screen.findByRole('heading', { level: 1, name: 'Use case' })).toBeInTheDocument();
    expect(within(main()).getByText('Something an actor does with the product to reach a goal.')).toBeInTheDocument();

    const where = section('Where it sits');
    expect(fact(where, 'Stage')).toBe('Define');
    expect(fact(where, 'Folder')).toMatch(/^Capabilities/);
    expect(within(section(/^Allowed parents/)).getByRole('link', { name: /domain/ })).toHaveAttribute('href', '/format/kinds/domain');

    const fields = document.getElementById('fields')!;
    expect(within(fields).getByText('actor').closest('li')).toHaveAttribute('id', 'field-actor');
    expect(fact(fields, 'ID')).toBe('<domain>-UC<nn>, such as DM-SHOP-UC01');
    expect(fact(fields, 'Obligation')).toMatch(/^Not an obligation/);

    // Links by their readable words, each naming the kind at the other end.
    const out = section(/^Links out/);
    expect(within(out).getByText('Applies')).toBeInTheDocument();
    expect(within(out).getByRole('link', { name: /domain_rule/ })).toHaveAttribute('href', '/format/kinds/domain_rule');
    const into = section(/^Links in/);
    expect(within(into).getByText('Questions about this')).toBeInTheDocument();

    expect(within(section(/^Checks that concern it/)).getByRole('link', { name: /use-case-without-flow/ })).toHaveAttribute('href', '/format/checks/use-case-without-flow');

    const example = section('Example');
    // The first use case by ID in the current space.
    expect(within(example).getByRole('link', { name: /DM-PAY-UC01/ })).toHaveAttribute('href', '/DM-PAY-UC01');
    expect(example.querySelector('pre')).toHaveTextContent(/id: DM-PAY-UC01\s+kind: use_case\s+title: Pay by card\s+parent: DM-PAY\s+actor: Shopper\s+---/);

    const records = section(/^Records/);
    expect(records).toHaveTextContent('2 use cases in Demo shop, under:');
    expect(within(records).getByRole('link', { name: /DM-SHOP\s*Shopping/ })).toHaveAttribute('href', '/DM-SHOP');
    expect(within(records).getByRole('link', { name: /DM-PAY\s*Paying/ })).toHaveAttribute('href', '/DM-PAY');

    // The side bar holds the kind's facts.
    expect(fact(sideBar(), 'Obligation')).toBe('None');
    expect(fact(sideBar(), 'Records')).toBe('2');
    expect(within(sideBar()).getByRole('link', { name: 'actor' })).toHaveAttribute('href', '#field-actor');
  });

  it('LA-AUT-T112 A check page shows its severity, explanation and source file, and its problems now as clickable rows', async () => {
    await openApp('/format/checks/unproved');
    expect(await screen.findByRole('heading', { level: 1, name: 'unproved' })).toBeInTheDocument();
    expect(within(main()).getByText('Every obligation is proved by a test.')).toBeInTheDocument();
    expect(within(main()).getByText('proves').tagName).toBe('STRONG');
    expect(within(pane()).getByText('checks/30-unproved.sql')).toBeInTheDocument();
    const problems = section(/^Problems now/);
    expect(problems).toHaveTextContent('Problems now2');
    const row = within(problems).getByRole('link', { name: 'DM-SHOP-DR01' });
    expect(row).toHaveClass('row-link');
    expect(row).toHaveAttribute('href', '/DM-SHOP-DR01');
    expect(fact(sideBar(), 'Problems')).toBe('2');
    expect(fact(sideBar(), 'Source')).toBe('checks/30-unproved.sql');

    // A check that reports nothing says so; an unknown one says it is not in the format.
    await openApp('/format/checks/use-case-without-flow');
    expect(await screen.findByText('This check reports nothing now.')).toBeInTheDocument();
    await openApp('/format/checks/no-such-check');
    expect(await screen.findByText(/The format has no check called/)).toBeInTheDocument();
    await openApp('/format/kinds/no_such_kind');
    expect(await screen.findByText(/The format has no kind called/)).toBeInTheDocument();
  });

  it('LA-AUT-T113 The side bar\'s kind, each problem code and each required field label link to their format pages', async () => {
    // The side bar's Details, open in the Graph view (brief 64).
    await openApp('/DM-SHOP-UC01?view=wiki,graph');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    expect(within(sideBar()).getByRole('link', { name: 'Use case' })).toHaveAttribute('href', '/format/kinds/use_case');
    expect(within(sideBar()).getByRole('link', { name: 'actor' })).toHaveAttribute('href', '/format/kinds/use_case#field-actor');

    // A problem's code on a record page, a domain page and the Checks page.
    await openApp('/DM-SHOP-DR01');
    await screen.findByRole('heading', { level: 1, name: 'A basket holds at most 50 items' });
    expect(within(sideBar()).getByRole('link', { name: 'unproved' })).toHaveAttribute('href', '/format/checks/unproved');
    await openApp('/DM-SHOP');
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    expect(within(section(/^Problems in this domain/)).getByRole('link', { name: 'test-file-missing' })).toHaveAttribute('href', '/format/checks/test-file-missing');
    await openApp('/DM/checks');
    await screen.findByRole('heading', { level: 1, name: 'Checks' });
    expect(within(main()).getByRole('link', { name: 'test-file-missing' })).toHaveAttribute('href', '/format/checks/test-file-missing');

    // A group's kind leads to the kind's page too.
    await openApp('/DM-SHOP/design/interaction-design/view');
    await screen.findByRole('heading', { level: 1, name: /^Views/ });
    expect(within(sideBar()).getByRole('link', { name: 'View' })).toHaveAttribute('href', '/format/kinds/view');
  });

  it('LA-AUT-T114 The record format is a palette command and a link in the shortcuts sheet, not a nav footer link', async () => {
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

  it('LA-AUT-T115 Quick find finds kinds and checks by name and leads to their pages', async () => {
    const items = findItems(indexWorkspace(workspace()), ['use-case-without-flow']);
    const kind = rankItems(items, 'Kind: Use case')[0];
    expect(kind).toMatchObject({ title: 'Kind: Use case', to: '/format/kinds/use_case' });
    expect(rankItems(items, 'use-case-without')[0]).toMatchObject({ title: 'Check: use-case-without-flow', to: '/format/checks/use-case-without-flow' });
    // A check that reports a problem now is found even before the reference loads.
    expect(rankItems(findItems(indexWorkspace(workspace()), []), 'unproved')[0]).toMatchObject({ title: 'Check: unproved' });

    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const find = screen.getAllByRole('combobox', { name: 'Quick find' })[0];
    await userEvent.type(find, 'Check: unpro');
    await userEvent.keyboard('{Enter}');
    expect(window.location.pathname).toBe('/format/checks/unproved');
  });

  it('LA-AUT-T116 Without the engine\'s reference the pages are built from the loaded specs, and say what is missing', async () => {
    const { requests } = await openApp('/format', { format: null });
    await screen.findByRole('heading', { level: 1, name: 'Record format' });
    await waitFor(() => expect(requests).toContain('GET /api/format'));
    expect(within(section(/^Checks\d/)).getByText(/the engine did not serve the format reference/)).toBeInTheDocument();
    expect(within(section(/^Checks\d/)).getByRole('link', { name: /unproved/ })).toHaveAttribute('href', '/format/checks/unproved');
    await openApp('/format/checks/unproved', { format: null });
    expect(await screen.findByText(/No explanation is available/)).toBeInTheDocument();
    expect(within(section(/^Problems now/)).getAllByRole('link').length).toBe(2);
  });

  it('LA-AUT-T117 Format addresses parse to their pages', () => {
    expect(parseSpecRoute('/format')).toEqual({ page: 'format' });
    expect(parseSpecRoute('/format/kinds/use_case')).toEqual({ page: 'format-kind', kind: 'use_case' });
    expect(parseSpecRoute('/format/checks/too-many-children')).toEqual({ page: 'format-check', check: 'too-many-children' });
    expect(parseSpecRoute('/format/other')).toEqual({ page: 'missing' });
  });
});
